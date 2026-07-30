import type { AppConfig } from "../../common/app-config";
import { NotFoundException } from "../../common/http-exception";
import { OTPPurpose, Role, SubscriptionStatus, AttemptStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import type { RequestAuditContext } from "../../common/http/request-context";
import { PrismaService } from "../../common/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { pickCurrentSubscriptionForDisplay } from "../subscriptions/subscription-access.utils";
import { CreateCustomUserDto } from "./dto/create-custom-user.dto";

export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly configService: AppConfig,
    private readonly auditService: AuditService
  ) {}

  listAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        whatsapp: true,
        profession: true,
        heardFrom: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        subscriptions: {
          select: {
            status: true,
            startDate: true,
            endDate: true,
            plan: { select: { id: true, name: true, tier: true } }
          },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });
  }

  async listSubscribed() {
    const users = await this.prisma.user.findMany({
      where: {
        role: Role.CANDIDATE,
        subscriptions: {
          some: {
            status: {
              in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED]
            }
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        subscriptions: {
          where: {
            status: {
              in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED]
            }
          },
          include: {
            plan: { select: { id: true, name: true, tier: true } }
          },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    const userIds = users.map((user) => user.id);
    const latestResults =
      userIds.length === 0
        ? []
        : await this.prisma.testResult.findMany({
            distinct: ["userId"],
            where: { userId: { in: userIds } },
            orderBy: [{ userId: "asc" }, { completedAt: "desc" }]
          });

    const bandByUser = new Map(latestResults.map((result) => [result.userId, result.bandLabel]));

    return users
      .map((user) => {
        const subscription = pickCurrentSubscriptionForDisplay(user.subscriptions);
        if (!subscription) {
          return null;
        }

        return {
          subscriptionId: subscription.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          plan: subscription.plan,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          currentBand: bandByUser.get(user.id) ?? null
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  async listProgressPaginated(page: number, limit: number) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(10, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const where = {
      role: Role.CANDIDATE,
      subscriptions: {
        some: {
          status: {
            in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED]
          }
        }
      }
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          subscriptions: {
            where: {
              status: {
                in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED]
              }
            },
            include: {
              plan: { select: { id: true, name: true, tier: true } }
            },
            orderBy: { createdAt: "desc" }
          },
          testResults: {
            orderBy: { completedAt: "desc" },
            take: 1,
            select: {
              bandLabel: true,
              passProbability: true,
              score: true
            }
          },
          _count: {
            select: {
              testResults: true,
              testAttempts: {
                where: {
                  status: {
                    in: [AttemptStatus.SUBMITTED, AttemptStatus.AUTO_SUBMITTED]
                  }
                }
              }
            }
          }
        }
      })
    ]);

    const items = users
      .map((user) => {
        const subscription = pickCurrentSubscriptionForDisplay(user.subscriptions);
        const latestResult = user.testResults[0] ?? null;

        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          subscriptionId: subscription?.id ?? null,
          plan: subscription?.plan ?? null,
          subscriptionStatus: subscription?.status ?? null,
          startDate: subscription?.startDate ?? null,
          endDate: subscription?.endDate ?? null,
          currentBand: latestResult?.bandLabel ?? null,
          latestPassProbability: latestResult?.passProbability ?? 0,
          retainedResultsCount: user._count.testResults,
          attemptsCount: user._count.testAttempts
        };
      })
      .filter((row) => row.plan !== null);

    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages
    };
  }

  async createCustomUser(dto: CreateCustomUserDto, context?: RequestAuditContext) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId }
    });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    const temporaryPassword = dto.temporaryPassword || `Temp@${randomUUID().slice(0, 8)}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user =
      existingUser ??
      (await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          role: Role.CANDIDATE,
          passwordHash,
          // Admin-created invites are trusted; activation OTP still gates plan access.
          emailVerifiedAt: new Date()
        }
      }));

    const activationToken = randomUUID();
    const appUrl = this.configService.get<string>("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
    const params = new URLSearchParams({
      activation: activationToken,
      email: user.email,
      returnTo: `/portal?activated=${plan.tier.toLowerCase()}`
    });
    const activationUrl = `${appUrl}/auth/activate?${params.toString()}`;

    const subscription = await this.subscriptionsService.assignPlanToUser(user.id, plan.id, {
      customAccessUrl: activationUrl
    });

    const otp = await this.authService.issueOtpForUser(user.id, OTPPurpose.SUBSCRIPTION_ACTIVATION, {
      activationUrl,
      planName: plan.name
    });

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        welcomeEmailSentAt: new Date()
      }
    });
    await this.auditService.record({
      ...context,
      action: "user.custom_created",
      entityType: "User",
      entityId: user.id,
      metadata: {
        existingUser: Boolean(existingUser),
        planId: plan.id,
        subscriptionId: subscription.id,
        activationUrl
      }
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      },
      subscription,
      activationUrl,
      temporaryPassword: existingUser ? null : temporaryPassword,
      otp,
      activationEmail: {
        toName: user.name,
        toEmail: user.email,
        planName: plan.name,
        otp,
        activationUrl,
        purchaseId: `invite-${user.id}`
      }
    };
  }

  async getProgress(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const [retainedResults, attempts, subscriptions] = await Promise.all([
      this.prisma.testResult.findMany({
        where: { userId },
        include: { test: true },
        orderBy: { completedAt: "desc" }
      }),
      this.prisma.testAttempt.findMany({
        where: { userId },
        include: { test: true },
        orderBy: { updatedAt: "desc" },
        take: 20
      }),
      this.prisma.subscription.findMany({
        where: {
          userId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL, SubscriptionStatus.EXPIRED] }
        },
        orderBy: { createdAt: "desc" },
        include: { plan: true }
      })
    ]);

    const subscription = pickCurrentSubscriptionForDisplay(subscriptions);

    const latestResult = retainedResults[0] ?? null;

    return {
      user,
      subscription,
      summary: {
        testsTaken: attempts.filter((attempt) => attempt.submittedAt).length,
        retainedResults: retainedResults.length,
        latestBand: latestResult?.bandLabel || null,
        latestPassProbability: latestResult?.passProbability || 0
      },
      retainedResults,
      attempts
    };
  }

  async getOverview() {
    const [users, activeSubs, expiredSubs, testsToday] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.EXPIRED } }),
      this.prisma.testAttempt.count({
        where: {
          submittedAt: {
            gte: this.startOfDay()
          }
        }
      })
    ]);

    return {
      users,
      activeSubscriptions: activeSubs,
      expiredSubscriptions: expiredSubs,
      testsToday
    };
  }

  private startOfDay() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}
