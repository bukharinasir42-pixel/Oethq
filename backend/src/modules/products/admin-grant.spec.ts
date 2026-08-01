/**
 * adminGrantProduct — a granted tier must supersede the user's other tiers of
 * the SAME skill.
 *
 * Each tier is its own entitlementKey (reading_foundation, reading_mega, …), and
 * getOwnership keeps the strongest tier per skill. So without superseding, an
 * admin "downgrade" from Mega to Foundation left Mega active and changed nothing
 * the student could see — the control would look like it worked and not work.
 */
import { ProductsService } from "./products.service";
import type { PrismaService } from "../../common/prisma.service";

const READING_MEGA = {
  id: "p-mega", slug: "reading-mega", entitlementKey: "reading_mega",
  category: "STANDALONE", durationDays: 60, tierRank: 4, includedSkills: ["READING"]
};
const READING_FOUNDATION = {
  id: "p-found", slug: "reading-foundation", entitlementKey: "reading_foundation",
  category: "STANDALONE", durationDays: 30, tierRank: 1, includedSkills: ["READING"]
};

function setup(existingActive: Array<{ id: string; product: { tierRank: number; includedSkills: string[] } | null }>) {
  const updateMany = jest.fn().mockResolvedValue({ count: 0 });
  const prisma = {
    product: { findUnique: jest.fn().mockResolvedValue(READING_FOUNDATION) },
    entitlement: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue(existingActive),
      updateMany
    }
  } as unknown as PrismaService;

  const svc = new ProductsService(prisma);
  // getOwnership is the return value, not what we are testing here.
  jest.spyOn(svc, "getOwnership").mockResolvedValue({} as never);
  return { svc, prisma, updateMany };
}

describe("adminGrantProduct — tier supersede", () => {
  it("revokes a higher tier of the same skill when downgrading", async () => {
    const { svc, updateMany } = setup([
      { id: "e-mega", product: { tierRank: READING_MEGA.tierRank, includedSkills: ["READING"] } }
    ]);
    await svc.adminGrantProduct("u1", "reading-foundation");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["e-mega"] } },
      data: { status: "REVOKED", endDate: expect.any(Date) }
    });
  });

  it("leaves the other skill alone", async () => {
    // Owning Listening Mega must survive a Reading downgrade untouched.
    const { svc, updateMany } = setup([
      { id: "e-listen", product: { tierRank: 4, includedSkills: ["LISTENING"] } }
    ]);
    await svc.adminGrantProduct("u1", "reading-foundation");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("leaves the Complete Material and non-tier products alone", async () => {
    // tierRank 0 = not a tier ladder entry (Complete, add-on packs, legacy).
    const { svc, updateMany } = setup([
      { id: "e-complete", product: { tierRank: 0, includedSkills: ["READING"] } },
      { id: "e-orphan", product: null }
    ]);
    await svc.adminGrantProduct("u1", "reading-foundation");
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("does nothing when the user holds no other tiers", async () => {
    const { svc, updateMany } = setup([]);
    await svc.adminGrantProduct("u1", "reading-foundation");
    expect(updateMany).not.toHaveBeenCalled();
  });
});
