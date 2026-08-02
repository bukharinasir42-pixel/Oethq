import type { Request } from "express";
import { deviceContextFromRequest, type RequestAuditContext } from "../common/http/request-context";

export function auditContextFromRequest(req: Request): RequestAuditContext {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedFor =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : Array.isArray(forwarded)
        ? forwarded[0]?.split(",")[0]?.trim()
        : undefined;
  const user = (req as Request & { user?: { id: string; email?: string } }).user;
  return {
    route: req.originalUrl || req.url,
    ipAddress: forwardedFor || req.ip || req.socket?.remoteAddress,
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    actorUserId: user?.id,
    actorEmail: user?.email,
    // Device id, fingerprint and CDN geo. Auth routes build their context HERE,
    // not with buildRequestAuditContext — without this the sign-in path never
    // sees x-device-id, no UserSession is ever created, and the two-device cap
    // silently does nothing at all.
    ...deviceContextFromRequest(req)
  };
}
