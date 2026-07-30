import type { NextFunction, Request, Response } from "express";
import { Prisma, Role } from "@prisma/client";
import { formatDbUnavailableMessage, isTransientDbError } from "../common/db-retry";
import {
  ForbiddenException,
  HttpException,
  UnauthorizedException
} from "../common/http-exception";
import type { JwtHelper } from "../common/jwt-helper";
import type { RateLimitService } from "../common/services/rate-limit.service";

export type AuthedRequest = Request & { user: { id: string; role: Role } };

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => void | Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function requireAuth(jwt: JwtHelper) {
  return asyncHandler(async (req, _res, next) => {
    const authz = req.headers.authorization;
    const token = typeof authz === "string" && authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
    if (!token) {
      throw new UnauthorizedException("Unauthorized");
    }
    try {
      const payload = await jwt.verifyAsync<{ sub: string; role: Role }>(token);
      (req as AuthedRequest).user = { id: payload.sub, role: payload.role };
      next();
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  });
}

export function requireAdmin() {
  return (req: Request, _res: Response, next: NextFunction) => {
    const u = (req as AuthedRequest).user;
    if (!u || u.role !== Role.ADMIN) {
      return next(new ForbiddenException("Admin only"));
    }
    next();
  };
}

export function rateLimitMiddleware(
  rateLimit: RateLimitService,
  keyPrefix: string,
  limit: number,
  windowSeconds: number
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const { allowed, retryAfterSeconds } = rateLimit.consume(key, limit, windowSeconds);
    if (!allowed) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message: "Too many requests", retryAfterSeconds });
    }
    next();
  };
}

// Express error middleware signature requires four arguments; `next` is unused when sending a response.
export function httpErrorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  void _next;
  if (err instanceof HttpException) {
    const body = err.getResponse();
    const status = err.getStatus();
    const message =
      typeof body === "string" ? body : (body as { message?: string }).message || "Error";
    res.status(status).json(typeof body === "object" ? body : { statusCode: status, message });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P1001") {
    res.status(503).json({
      statusCode: 503,
      message: formatDbUnavailableMessage()
    });
    return;
  }
  if (err instanceof Error && isTransientDbError(err)) {
    res.status(503).json({
      statusCode: 503,
      message: formatDbUnavailableMessage()
    });
    return;
  }
  if (err instanceof Error && "statusCode" in err && typeof (err as Error & { statusCode: number }).statusCode === "number") {
    const status = (err as Error & { statusCode: number }).statusCode;
    res.status(status).json({ statusCode: status, message: err.message });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ statusCode: 500, message: err instanceof Error ? err.message : "Internal server error" });
}
