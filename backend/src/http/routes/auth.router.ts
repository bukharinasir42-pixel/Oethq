import { Router } from "express";
import { LoginDto } from "../../modules/auth/dto/login.dto";
import { RegisterDto } from "../../modules/auth/dto/register.dto";
import { ForgotPasswordDto } from "../../modules/auth/dto/forgot-password.dto";
import { ResetPasswordDto } from "../../modules/auth/dto/reset-password.dto";
import { VerifyPasswordResetCodeDto } from "../../modules/auth/dto/verify-password-reset-code.dto";
import { ResendOtpDto } from "../../modules/auth/dto/resend-otp.dto";
import { ResendActivationOtpDto } from "../../modules/auth/dto/resend-activation-otp.dto";
import { ActivateSubscriptionDto } from "../../modules/auth/dto/activate-subscription.dto";
import { VerifyOtpDto } from "../../modules/auth/dto/verify-otp.dto";
import type { AppContainer } from "../container";
import { asyncHandler, rateLimitMiddleware, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";
import { auditContextFromRequest } from "../request-audit";
import { PROFESSIONS } from "../../common/professions";
import { validateDto } from "../validation";

export function createAuthRouter(c: AppContainer) {
  const r = Router();

  r.post(
    "/register",
    rateLimitMiddleware(c.rateLimit, "auth-register", 20, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(RegisterDto, req.body);
      const out = await c.authService.register(dto, auditContextFromRequest(req));
      res.json(out);
    })
  );

  r.post(
    "/login",
    rateLimitMiddleware(c.rateLimit, "auth-login", 30, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(LoginDto, req.body);
      const out = await c.authService.login(dto, auditContextFromRequest(req));
      res.json(out);
    })
  );

  r.post(
    "/otp/verify",
    rateLimitMiddleware(c.rateLimit, "auth-otp", 40, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(VerifyOtpDto, req.body);
      const out = await c.authService.verifyOtp(dto, auditContextFromRequest(req));
      res.json(out);
    })
  );

  r.post(
    "/otp/resend",
    rateLimitMiddleware(c.rateLimit, "auth-otp-resend", 10, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(ResendOtpDto, req.body);
      const out = await c.authService.resendOtp(dto);
      res.json(out);
    })
  );

  r.post(
    "/password/forgot",
    rateLimitMiddleware(c.rateLimit, "auth-password-forgot", 10, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(ForgotPasswordDto, req.body);
      const out = await c.authService.requestPasswordReset(dto, auditContextFromRequest(req));
      res.json(out);
    })
  );

  r.post(
    "/password/verify-code",
    rateLimitMiddleware(c.rateLimit, "auth-password-verify", 40, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(VerifyPasswordResetCodeDto, req.body);
      const out = await c.authService.verifyPasswordResetCode(dto);
      res.json(out);
    })
  );

  r.post(
    "/password/reset",
    rateLimitMiddleware(c.rateLimit, "auth-password-reset", 20, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(ResetPasswordDto, req.body);
      const out = await c.authService.resetPassword(dto, auditContextFromRequest(req));
      res.json(out);
    })
  );

  r.get(
    "/activation/:token",
    rateLimitMiddleware(c.rateLimit, "auth-activation-info", 40, 300),
    asyncHandler(async (req, res) => {
      const out = await c.authService.getActivationInfo(req.params.token);
      res.json(out);
    })
  );

  r.post(
    "/activation/verify",
    rateLimitMiddleware(c.rateLimit, "auth-activation-verify", 40, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(ActivateSubscriptionDto, req.body);
      const out = await c.authService.activateSubscriptionWithOtp(dto, auditContextFromRequest(req));
      res.json(out);
    })
  );

  r.post(
    "/activation/resend",
    rateLimitMiddleware(c.rateLimit, "auth-activation-resend", 10, 300),
    asyncHandler(async (req, res) => {
      const dto = await validateDto(ResendActivationOtpDto, req.body);
      const out = await c.authService.resendActivationOtp(dto);
      res.json(out);
    })
  );

  r.get(
    "/me",
    requireAuth(c.jwtHelper),
    asyncHandler(async (req, res) => {
      const u = (req as import("../middleware").AuthedRequest).user;
      const out = await c.authService.me(u.id);
      res.json(out);
    })
  );

  // Sign out THIS device. Ends the session server-side so the token cannot be
  // replayed, which a stateless bearer token never allowed.
  r.post(
    "/logout",
    requireAuth(c.jwtHelper),
    asyncHandler(async (req, res) => {
      const sid = (req as AuthedRequest).user.sessionId;
      if (sid) await c.deviceSessions.revoke(sid, "signed_out");
      res.json({ ok: true });
    })
  );

  // The list the portal renders in its picker, so the two cannot drift.
  r.get("/professions", asyncHandler(async (_req, res) => {
    res.json({ professions: PROFESSIONS });
  }));

  // A student setting or changing their own profession.
  r.patch(
    "/me/profession",
    requireAuth(c.jwtHelper),
    asyncHandler(async (req, res) => {
      const u = (req as AuthedRequest).user;
      res.json(await c.authService.setProfession(u.id, String(req.body?.profession ?? "")));
    })
  );

  return r;
}
