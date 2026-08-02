/**
 * The device cap. Two properties matter more than the count itself:
 *
 *  - a returning device must RESUME its session, never consume a second slot;
 *  - eviction must be silent and hit the least-recently-used device.
 */
import { Role } from "@prisma/client";
import { DEVICE_LIMIT, DeviceSessionService, describeDevice } from "./device-session.service";
import type { PrismaService } from "../../common/prisma.service";

const HOUR = 3_600_000;

function setup(live: Array<{ id: string; lastSeenAt: Date }>, existing: unknown = null, byFp: unknown = null) {
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const create = jest.fn().mockResolvedValue({ id: "new-session" });
  const update = jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id }));
  const prisma = {
    userSession: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findFirst: jest.fn().mockResolvedValue(byFp),
      findMany: jest.fn().mockResolvedValue(live),
      create,
      update,
      updateMany
    }
  } as unknown as PrismaService;
  return { svc: new DeviceSessionService(prisma), updateMany, create, update, prisma };
}

const candidate = (deviceId: string, fingerprint?: string) => ({
  userId: "u1",
  role: Role.CANDIDATE,
  deviceId,
  fingerprint,
  userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120",
  ip: "1.2.3.4"
});

describe("DeviceSessionService", () => {
  it("caps a student at two devices and evicts the least recently used", async () => {
    const now = Date.now();
    const { svc, updateMany, create } = setup([
      { id: "old", lastSeenAt: new Date(now - 48 * HOUR) },
      { id: "recent", lastSeenAt: new Date(now - HOUR) }
    ]);
    await svc.open(candidate("device-3"));
    // Oldest out, newest in — and nothing thrown, so the student sees no error.
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["old"] } },
      data: { revokedAt: expect.any(Date), revokedReason: "device_limit" }
    });
    expect(create).toHaveBeenCalled();
  });

  it("does not evict when the student is under the cap", async () => {
    const { svc, updateMany } = setup([{ id: "only", lastSeenAt: new Date() }]);
    await svc.open(candidate("device-2"));
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("resumes a known device instead of spending the second slot", async () => {
    // Signing out and back in on the same laptop must not count as a new device.
    const { svc, updateMany, create, update } = setup(
      [{ id: "a", lastSeenAt: new Date() }, { id: "b", lastSeenAt: new Date() }],
      { id: "a", fingerprint: "fp1", userAgent: null, ip: null }
    );
    const sid = await svc.open(candidate("device-a", "fp1"));
    expect(sid).toBe("a");
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it("re-links by fingerprint when site data was cleared", async () => {
    // New device id, same machine: match on the fingerprint and reuse the row,
    // otherwise clearing the browser silently burns a slot and a private window
    // becomes a way to get a third device.
    const { svc, create, update, prisma } = setup(
      [{ id: "a", lastSeenAt: new Date() }, { id: "b", lastSeenAt: new Date() }],
      null,
      { id: "a", fingerprint: "fp1", userAgent: null, ip: null }
    );
    const sid = await svc.open(candidate("brand-new-id", "fp1"));
    expect(sid).toBe("a");
    expect(create).not.toHaveBeenCalled();
    // The row adopts the new device id so the next visit matches directly.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deviceId: "brand-new-id" }) })
    );
    // Fingerprint lookups are scoped to the user — a shared clinic PC must never
    // merge two students onto one session.
    expect((prisma.userSession.findFirst as jest.Mock).mock.calls[0][0].where).toMatchObject({
      userId: "u1",
      fingerprint: "fp1"
    });
  });

  it("exempts admins from the cap", async () => {
    const { svc, updateMany, create } = setup([
      { id: "a", lastSeenAt: new Date() },
      { id: "b", lastSeenAt: new Date() },
      { id: "c", lastSeenAt: new Date() }
    ]);
    await svc.open({ ...candidate("admin-device"), role: Role.ADMIN });
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });

  it("labels devices for the admin list", () => {
    expect(describeDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605")).toBe("Safari on iOS");
    expect(describeDevice("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBe("Chrome on Windows");
    expect(describeDevice(null)).toBe("Unknown device");
  });

  it("keeps the cap at two", () => {
    expect(DEVICE_LIMIT).toBe(2);
  });
});
