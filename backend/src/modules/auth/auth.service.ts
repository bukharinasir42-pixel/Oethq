import type { AppConfig } from "../../common/app-config";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from "../../common/http-exception";
import { JwtHelper } from "../../common/jwt-helper";
import { PrismaService } from "../../common/prisma.service";
import type { RequestAuditContext } from "../../common/http/request-context";
import { createLogger } from "../../common/logger";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyPasswordResetCodeDto } from "./dto/verify-password-reset-code.dto";
import { ResendOtpDto } from "./dto/resend-otp.dto";
import { ResendActivationOtpDto } from "./dto/resend-activation-otp.dto";
import { ActivateSubscriptionDto } from "./dto/activate-subscription.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import * as bcrypt from "bcrypt";
import { OTPPurpose, PlanTier, Role, SubscriptionStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { DeviceSessionService } from "./device-session.service";
import { EmailService } from "../email/email.service";
import {
  calendarDaysRemaining,
  pickEffectiveSubscriptionForAccess,
  pickPendingActivationSubscription
} from "../subscriptions/subscription-access.utils";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class AuthService {
  private readonly logger = createLogger("AuthService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtHelper: JwtHelper,
    private readonly configService: AppConfig,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
    private readonly deviceSessions?: DeviceSessionService
  ) {}


  /**
   * Issue an access token bound to this device's session.
   *
   * Every path that signs a user in goes through here, so no route can hand out
   * a token that escapes the device cap or that cannot later be revoked.
   * `deviceId` comes from the x-device-id header the browser sends; when it is
   * missing (an old client, or a non-browser caller) we fall back to a stateless
   * token so nobody is locked out by the upgrade.
   */
  private async issueAccessToken(user: { id: string; role: Role }, context?: RequestAuditContext) {
    const deviceId = context?.deviceId?.trim();
    if (!deviceId || !this.deviceSessions) {
      return this.jwtHelper.signAsync({ sub: user.id, role: user.role });
    }
    const sid = await this.deviceSessions.open({
      userId: user.id,
      role: user.role,
      deviceId,
      fingerprint: context?.fingerprint ?? null,
      userAgent: context?.userAgent ?? null,
      ip: context?.ipAddress ?? null
    });
    return this.jwtHelper.signAsync({ sub: user.id, role: user.role, sid });
  }

  async register(dto: RegisterDto, context?: RequestAuditContext) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException("Email already registered");
    }

    const whatsapp = dto.whatsapp?.trim() || null;
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        whatsapp,
        profession: dto.profession?.trim() || null,
        heardFrom: dto.heardFrom?.trim() || null,
        passwordHash,
        emailVerifiedAt: null
      }
    });

    await this.auditService.record({
      ...context,
      actorUserId: user.id,
      actorEmail: user.email,
      action: "auth.register",
      entityType: "User",
      entityId: user.id,
      metadata: {
        email: user.email,
        whatsapp: user.whatsapp
      }
    });

    await this.issueOtpForUser(user.id, OTPPurpose.REGISTER);

    return {
      message: "Registration successful. Enter the verification code sent to your email.",
      email: user.email,
      name: user.name,
      requiresOtp: true
    };
  }

  async login(dto: LoginDto, context?: RequestAuditContext) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (user.suspendedAt) {
      throw new ForbiddenException(
        "Your account has been suspended for exam-integrity reasons. Please contact support to be reinstated."
      );
    }

    if (this.requiresEmailVerification(user)) {
      await this.ensurePendingOtp(user.id, OTPPurpose.REGISTER);
      return {
        message: "Email not verified. Enter the verification code sent to your email.",
        email: user.email,
        name: user.name,
        requiresOtp: true
      };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });
    await this.auditService.record({
      ...context,
      actorUserId: user.id,
      actorEmail: user.email,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      metadata: {
        email: user.email
      }
    });

    // Paid plans start only after purchase activation OTP. Free trial is opt-in from packages.
    const accessToken = await this.issueAccessToken(user, context);

    const access = await this.getCandidateAccessState(user.id, user.role);

    return {
      message: access.accessExpired
        ? "Login successful, but your access window has expired. Choose a plan to continue."
        : access.requiresPlanActivation
          ? "Login successful. Activate your purchased plan with the OTP from your email to start the access window."
          : access.accessGranted
            ? "Login successful."
            : "Login successful. Choose a plan on the home page to start studying.",
      accessToken,
      role: user.role,
      email: user.email,
      name: user.name,
      requiresOtp: false,
      requiresPlanActivation: access.requiresPlanActivation,
      activationUrl: access.activationUrl,
      accessGranted: access.accessGranted,
      accessExpired: access.accessExpired,
      expiresInDays: access.expiresInDays
    };
  }

  async verifyOtp(dto: VerifyOtpDto, context?: RequestAuditContext) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException("User not found");

    const otpRecord = await this.prisma.oTPCode.findFirst({
      where: {
        userId: user.id,
        code: dto.code,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!otpRecord) {
      throw new BadRequestException("Invalid or expired OTP");
    }

    await this.prisma.oTPCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt: new Date() }
    });

    const verifiedAt = new Date();
    const isRegistrationOtp = otpRecord.purpose === OTPPurpose.REGISTER;

    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: verifiedAt,
          // Registration verify should not auto-login; other OTP flows may.
          ...(isRegistrationOtp ? {} : { lastLogin: verifiedAt })
        }
      });
    } else if (!isRegistrationOtp) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: verifiedAt }
      });
    }

    await this.auditService.record({
      ...context,
      actorUserId: user.id,
      actorEmail: user.email,
      action: "auth.otp_verified",
      entityType: "OTPCode",
      entityId: otpRecord.id,
      metadata: {
        purpose: otpRecord.purpose,
        email: user.email
      }
    });

    // After registration OTP: email is verified — candidate must sign in next.
    if (isRegistrationOtp) {
      return {
        message: "OTP verified. Your email is confirmed. Please sign in to continue.",
        email: user.email,
        name: user.name,
        requiresOtp: false,
        verified: true
      };
    }

    // Paid plan windows start ONLY via /auth/activate (activation link + SUBSCRIPTION_ACTIVATION OTP).
    // Free trial OTP may start the starter window only.
    if (otpRecord.purpose === OTPPurpose.FREE_TRIAL) {
      await this.activateStarterSubscriptionIfNeeded(user.id);
    }

    const accessToken = await this.issueAccessToken(user, context);

    return {
      message:
        otpRecord.purpose === OTPPurpose.FREE_TRIAL
          ? "Free trial activated. Your access window has started."
          : otpRecord.purpose === OTPPurpose.SUBSCRIPTION_ACTIVATION
            ? "Use your activation link to verify this code and start your plan window."
            : "Email verified successfully.",
      accessToken,
      role: user.role,
      email: user.email,
      name: user.name,
      requiresOtp: false
    };
  }

  async getActivationInfo(activationToken: string) {
    const target = await this.resolveActivationTarget(activationToken);

    const alreadyActivated = Boolean(
      target.subscription.otpVerifiedAt && target.subscription.startDate && target.subscription.endDate
    );
    const accessExpired = Boolean(
      alreadyActivated &&
        target.subscription.endDate &&
        target.subscription.endDate.getTime() <= Date.now()
    );

    return {
      email: target.user.email,
      name: target.user.name,
      planName: target.plan.name,
      planTier: target.plan.tier,
      durationDays: target.plan.durationDays || 60,
      alreadyActivated,
      accessExpired,
      activationToken
    };
  }

  async activateSubscriptionWithOtp(dto: ActivateSubscriptionDto, context?: RequestAuditContext) {
    const target = await this.resolveActivationTarget(dto.activationToken);
    const { user, plan, subscription, purchaseId } = target;

    if (subscription.otpVerifiedAt && subscription.startDate && subscription.endDate) {
      const now = new Date();
      if (subscription.endDate.getTime() <= now.getTime()) {
        throw new BadRequestException(
          "This plan’s access window has expired. Purchase or renew a plan to continue."
        );
      }

      const accessToken = await this.issueAccessToken(user, context);
      return {
        message: "This plan is already activated. Your access window is still open.",
        accessToken,
        role: user.role,
        email: user.email,
        name: user.name,
        alreadyActivated: true,
        accessGranted: true,
        accessExpired: false,
        endDate: subscription.endDate
      };
    }

    const otpRecord = await this.prisma.oTPCode.findFirst({
      where: {
        userId: user.id,
        code: dto.code,
        purpose: OTPPurpose.SUBSCRIPTION_ACTIVATION,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!otpRecord) {
      throw new BadRequestException("Invalid or expired OTP");
    }

    await this.prisma.oTPCode.update({
      where: { id: otpRecord.id },
      data: { consumedAt: new Date() }
    });

    const activated = await this.startSubscriptionWindow(user.id, plan.id);

    await this.auditService.record({
      ...context,
      actorUserId: user.id,
      actorEmail: user.email,
      action: "auth.subscription_activated",
      entityType: "Subscription",
      entityId: activated.id,
      metadata: {
        purchaseId,
        planId: plan.id,
        email: user.email
      }
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(),
        emailVerifiedAt: user.emailVerifiedAt || new Date()
      }
    });

    const accessToken = await this.issueAccessToken(user, context);

    return {
      message: `OTP verified. Your ${plan.durationDays || 60}-day access window has started.`,
      accessToken,
      role: user.role,
      email: user.email,
      name: user.name,
      alreadyActivated: false,
      endDate: activated.endDate
    };
  }

  async resendActivationOtp(dto: ResendActivationOtpDto) {
    const info = await this.getActivationInfo(dto.activationToken);
    if (info.alreadyActivated) {
      throw new BadRequestException("This plan is already activated. You can sign in.");
    }

    const target = await this.resolveActivationTarget(dto.activationToken);

    await this.issueOtpForUser(target.user.id, OTPPurpose.SUBSCRIPTION_ACTIVATION, {
      activationUrl: target.subscription.customAccessUrl || undefined,
      planName: target.plan.name
    });

    return {
      message: "A new activation code has been sent to your email.",
      email: target.user.email,
      requiresOtp: true
    };
  }

  private async resolveActivationTarget(activationToken: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { activationToken },
      include: {
        user: true,
        plan: true
      }
    });

    if (purchase) {
      if (purchase.user.role !== Role.CANDIDATE) {
        throw new BadRequestException("Plan activation is only available for candidates");
      }
      const subscription = await this.prisma.subscription.findUnique({
        where: {
          userId_planId: {
            userId: purchase.userId,
            planId: purchase.planId
          }
        }
      });
      if (!subscription) {
        throw new NotFoundException("Subscription not found for this activation link");
      }
      return {
        user: purchase.user,
        plan: purchase.plan,
        subscription,
        purchaseId: purchase.id
      };
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        customAccessUrl: { contains: `activation=${activationToken}` }
      },
      include: {
        user: true,
        plan: true
      }
    });

    if (!subscription) {
      throw new NotFoundException("Activation link is invalid or expired");
    }

    if (subscription.user.role !== Role.CANDIDATE) {
      throw new BadRequestException("Plan activation is only available for candidates");
    }

    return {
      user: subscription.user,
      plan: subscription.plan,
      subscription,
      purchaseId: null as string | null
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      // Avoid email enumeration
      return {
        message: "If an account exists for that email, a new verification code has been sent.",
        email: dto.email,
        requiresOtp: true
      };
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException("Email is already verified. You can sign in.");
    }

    await this.issueOtpForUser(user.id, OTPPurpose.REGISTER);

    return {
      message: "A new verification code has been sent to your email.",
      email: user.email,
      requiresOtp: true
    };
  }

  async requestPasswordReset(dto: ForgotPasswordDto, context?: RequestAuditContext) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (user) {
      await this.issueOtpForUser(user.id, OTPPurpose.PASSWORD_RESET);
      await this.auditService.record({
        ...context,
        actorUserId: user.id,
        actorEmail: user.email,
        action: "auth.password_reset_requested",
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email }
      });
    }

    return {
      message: "If an account exists for that email, a password reset code has been sent.",
      email: dto.email
    };
  }

  async verifyPasswordResetCode(dto: VerifyPasswordResetCodeDto) {
    const otpRecord = await this.findValidPasswordResetOtp(dto.email, dto.code);
    if (!otpRecord) {
      throw new BadRequestException("Invalid or expired reset code");
    }

    return {
      message: "Code verified. Choose your new password.",
      email: dto.email,
      verified: true
    };
  }

  async resetPassword(dto: ResetPasswordDto, context?: RequestAuditContext) {
    const otpRecord = await this.findValidPasswordResetOtp(dto.email, dto.code);
    if (!otpRecord) {
      throw new BadRequestException("Invalid or expired reset code");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.oTPCode.update({
        where: { id: otpRecord.id },
        data: { consumedAt: new Date() }
      }),
      this.prisma.user.update({
        where: { id: otpRecord.userId },
        data: { passwordHash }
      })
    ]);

    const user = await this.prisma.user.findUnique({
      where: { id: otpRecord.userId },
      select: { email: true }
    });

    await this.auditService.record({
      ...context,
      actorUserId: otpRecord.userId,
      actorEmail: user?.email,
      action: "auth.password_reset",
      entityType: "User",
      entityId: otpRecord.userId,
      metadata: { email: user?.email }
    });

    return {
      message: "Password updated. You can sign in with your new password.",
      email: user?.email
    };
  }

  private async findValidPasswordResetOtp(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return null;
    }

    return this.prisma.oTPCode.findFirst({
      where: {
        userId: user.id,
        code,
        purpose: OTPPurpose.PASSWORD_RESET,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerifiedAt: true,
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { plan: true }
        }
      }
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async issueOtpForUser(
    userId: string,
    purpose: OTPPurpose,
    options?: {
      activationUrl?: string;
      planName?: string;
    }
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const code = await this.createOtpRecord(user.id, purpose);
    try {
      const result = await this.dispatchOtpEmail(user.email, purpose, code, options);
      this.logger.log(
        `OTP email for ${user.email} (${purpose}) provider=${result.provider || "none"} delivered=${result.delivered}`
      );
      if (!result.delivered && purpose === OTPPurpose.SUBSCRIPTION_ACTIVATION) {
        throw new Error("Activation email was not delivered by any SMTP provider");
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`OTP email failed for ${user.email} (${purpose}): ${detail}`);
      if (purpose === OTPPurpose.SUBSCRIPTION_ACTIVATION) {
        throw error instanceof Error ? error : new Error(detail);
      }
    }
    return code;
  }

  private requiresEmailVerification(user: { role: Role; emailVerifiedAt: Date | null }) {
    return user.role === Role.CANDIDATE && !user.emailVerifiedAt;
  }

  private async ensurePendingOtp(userId: string, purpose: OTPPurpose) {
    const existing = await this.prisma.oTPCode.findFirst({
      where: {
        userId,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: "desc" }
    });

    if (!existing) {
      await this.issueOtpForUser(userId, purpose);
    } else {
      // Re-send the same pending code so the candidate can continue verification.
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        try {
          await this.dispatchOtpEmail(user.email, purpose, existing.code);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          this.logger.warn(`OTP resend failed for ${user.email}: ${detail}`);
        }
      }
    }
  }


  /**
   * Open a purchased plan's access window now. Returns the days granted, or null
   * if the plan row has gone. Shared by the activation-OTP path and the
   * already-verified fast path, so the window is started one way only.
   */
  private async startPlanWindow(subscriptionId: string): Promise<number | null> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true }
    });
    if (!subscription?.plan) return null;
    const now = new Date();
    const days = subscription.plan.durationDays || 60;
    const endDate = new Date(now.getTime() + days * 86_400_000);
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        endDate,
        otpVerifiedAt: now
      }
    });
    this.logger.log(`plan window opened without a second OTP: subscription=${subscription.id} (${days}d)`);
    return days;
  }

  private async getPendingPaidActivation(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true }
    });
    const pending = pickPendingActivationSubscription(subscriptions);
    if (!pending || pending.plan.tier === PlanTier.STARTER) {
      return null;
    }
    return pending;
  }

  private async getCandidateAccessState(userId: string, role: Role) {
    if (role !== Role.CANDIDATE) {
      return {
        accessGranted: true,
        accessExpired: false,
        requiresPlanActivation: false,
        activationUrl: undefined as string | undefined,
        expiresInDays: undefined as number | undefined
      };
    }

    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true }
    });
    const now = new Date();

    // Mark past-window subscriptions expired.
    const expiredIds = subscriptions
      .filter(
        (row) =>
          row.endDate &&
          row.endDate.getTime() <= now.getTime() &&
          row.status !== SubscriptionStatus.EXPIRED
      )
      .map((row) => row.id);
    if (expiredIds.length > 0) {
      await this.prisma.subscription.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: SubscriptionStatus.EXPIRED }
      });
      for (const row of subscriptions) {
        if (expiredIds.includes(row.id)) {
          row.status = SubscriptionStatus.EXPIRED;
        }
      }
    }

    const active = pickEffectiveSubscriptionForAccess(subscriptions, now);
    if (active?.endDate) {
      const expiresInDays = calendarDaysRemaining(active.endDate, now);
      return {
        accessGranted: true,
        accessExpired: false,
        requiresPlanActivation: false,
        activationUrl: undefined as string | undefined,
        expiresInDays
      };
    }

    const pending = await this.getPendingPaidActivation(userId);
    if (pending) {
      // A student whose email is already verified has proved they own the inbox.
      // Making them find a SECOND code before their paid plan starts adds a step
      // that establishes nothing new, and it is the step most people abandon on.
      // Start the window here instead and let them straight in.
      //
      // Set REQUIRE_PLAN_ACTIVATION_OTP=1 to restore the old two-code flow.
      const stillRequireOtp = this.configService.get("REQUIRE_PLAN_ACTIVATION_OTP") === "1";
      const emailVerified = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerifiedAt: true }
      });
      if (!stillRequireOtp && emailVerified?.emailVerifiedAt) {
        const started = await this.startPlanWindow(pending.id);
        if (started) {
          return {
            accessGranted: true,
            accessExpired: false,
            requiresPlanActivation: false,
            activationUrl: undefined as string | undefined,
            expiresInDays: started
          };
        }
      }
      return {
        accessGranted: false,
        accessExpired: false,
        requiresPlanActivation: true,
        activationUrl: pending.customAccessUrl || undefined,
        expiresInDays: 0
      };
    }

    const hadExpiredWindow = subscriptions.some(
      (row) =>
        row.status === SubscriptionStatus.EXPIRED ||
        (row.otpVerifiedAt && row.endDate && row.endDate.getTime() <= now.getTime())
    );

    return {
      accessGranted: false,
      accessExpired: hadExpiredWindow,
      requiresPlanActivation: false,
      activationUrl: undefined as string | undefined,
      expiresInDays: 0
    };
  }

  private async activateStarterSubscriptionIfNeeded(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true }
    });
    const starter = subscriptions.find(
      (row) =>
        row.plan.tier === PlanTier.STARTER &&
        !row.otpVerifiedAt &&
        (row.status === SubscriptionStatus.TRIAL || row.status === SubscriptionStatus.ACTIVE)
    );
    if (!starter) return;
    await this.startSubscriptionWindow(userId, starter.planId);
  }

  /** Paid plans: start window only from activateSubscriptionWithOtp (activation link + OTP). */
  private async startSubscriptionWindow(userId: string, planId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: {
        userId_planId: { userId, planId }
      },
      include: { plan: true }
    });
    if (!subscription) {
      throw new NotFoundException("Subscription not found");
    }
    if (subscription.otpVerifiedAt && subscription.startDate && subscription.endDate) {
      return subscription;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (subscription.plan.durationDays || 60));

    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status:
          subscription.plan.tier === PlanTier.STARTER ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        otpVerifiedAt: startDate,
        trialUsed: subscription.plan.tier === PlanTier.STARTER ? true : subscription.trialUsed
      },
      include: { plan: true }
    });
  }

  private async createOtpRecord(userId: string, purpose: OTPPurpose) {
    const code = generateOtp();
    const expiresInMinutes = Number(this.configService.get("OTP_EXPIRY_MINUTES") || 10);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.prisma.oTPCode.create({
      data: {
        userId,
        code,
        purpose,
        expiresAt
      }
    });

    return code;
  }

  private async dispatchOtpEmail(
    email: string,
    purpose: OTPPurpose,
    code: string,
    options?: {
      activationUrl?: string;
      planName?: string;
    }
  ) {
    switch (purpose) {
      case OTPPurpose.FREE_TRIAL:
        return this.emailService.sendFreeTrialEmail(email, code);
      case OTPPurpose.SUBSCRIPTION_ACTIVATION:
        return this.emailService.sendPurchaseSuccessEmail(
          email,
          options?.planName || "OET LMS subscription",
          code,
          options?.activationUrl || this.getDefaultPortalUrl()
        );
      case OTPPurpose.LOGIN:
      case OTPPurpose.REGISTER:
      case OTPPurpose.PASSWORD_RESET:
        return this.emailService.sendOtpEmail(email, code, purpose);
      default: {
        const exhaustiveCheck: never = purpose;
        return exhaustiveCheck;
      }
    }
  }

  private getDefaultPortalUrl() {
    return `${this.configService.get<string>("NEXT_PUBLIC_APP_URL") || "http://localhost:3000"}/portal`;
  }
}
