import type { Request } from "express";

export type RequestAuditContext = {
  route?: string;
  ipAddress?: string;
  userAgent?: string;
  actorUserId?: string;
  actorEmail?: string;
  /**
   * Browser-generated device id (x-device-id). Rides along here so every
   * existing caller carries it without a new parameter on 20-odd signatures.
   */
  deviceId?: string;
  /** Hash of stable browser traits (x-device-fp). */
  fingerprint?: string;
};

type CurrentUserLike = {
  userId?: string;
  email?: string;
};

function firstForwardedValue(value: string | string[] | undefined) {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw.split(",")[0]?.trim() || undefined;
}

export function buildRequestAuditContext(
  req: Request,
  currentUser?: CurrentUserLike | null
): RequestAuditContext {
  const requestUser = (req as Request & { user?: CurrentUserLike }).user;
  const forwardedFor = firstForwardedValue(req.headers["x-forwarded-for"]);
  const ipAddress = forwardedFor || req.ip || req.socket.remoteAddress || undefined;

  return {
    route: req.originalUrl || req.url,
    ipAddress,
    userAgent: req.get("user-agent") || undefined,
    actorUserId: currentUser?.userId || requestUser?.userId,
    actorEmail: currentUser?.email || requestUser?.email,
    deviceId: firstForwardedValue(req.headers["x-device-id"]) || undefined,
    fingerprint: firstForwardedValue(req.headers["x-device-fp"]) || undefined
  };
}
