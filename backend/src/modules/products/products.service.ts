/**
 * ProductsService — course catalogue + multi-product entitlements.
 *
 * Sits ALONGSIDE the existing Plan/Subscription (Complete Course) system, which
 * is untouched. Standalone courses are Products; buying one creates a
 * ProductPurchase and grants an additive Entitlement (users can hold several).
 *
 * Locked (COMING_SOON / !isPurchasable) products are presentation-only: they can
 * never start a checkout or grant an entitlement (hard-enforced here).
 */
import { Prisma, ProductStatus } from "@prisma/client";
import type { PrismaService } from "../../common/prisma.service";

function priceLabel(price: Prisma.Decimal | null, status: ProductStatus): string {
  if (status === ProductStatus.COMING_SOON) return "Coming soon";
  if (price == null) return "Pricing coming soon";
  return `$${Number(price).toFixed(Number.isInteger(Number(price)) ? 0 : 2)}`;
}

export type CatalogueProduct = {
  slug: string;
  name: string;
  category: string;
  status: string;
  displayOrder: number;
  shortDescription: string | null;
  landingRoute: string | null;
  price: number | null;
  currency: string;
  priceLabel: string;
  durationDays: number | null;
  includedSkills: string[];
  includedModules: unknown;
  entitlementKey: string;
  isPurchasable: boolean;
  featured: boolean;
  upgradeOfSlug: string | null;
  writingCorrections: number;
  tierRank: number;
  mockTestLimit: number;
  pastPaperLimit: number;
  caseNoteLimit: number;
  passPredictor: boolean;
  retired: boolean;
};

export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private toCatalogue(p: {
    slug: string; name: string; category: string; status: ProductStatus; displayOrder: number;
    shortDescription: string | null; landingRoute: string | null; price: Prisma.Decimal | null;
    currency: string; durationDays: number | null; includedSkills: string[]; includedModules: unknown;
    entitlementKey: string; isPurchasable: boolean; featured: boolean; upgradeOfSlug: string | null;
    writingCorrections?: number; tierRank?: number; mockTestLimit?: number; pastPaperLimit?: number;
    caseNoteLimit?: number; passPredictor?: boolean; retiredAt?: Date | null;
  }): CatalogueProduct {
    return {
      slug: p.slug,
      name: p.name,
      category: p.category,
      status: p.status,
      displayOrder: p.displayOrder,
      shortDescription: p.shortDescription,
      landingRoute: p.landingRoute,
      price: p.price == null ? null : Number(p.price),
      currency: p.currency,
      priceLabel: priceLabel(p.price, p.status),
      durationDays: p.durationDays,
      includedSkills: p.includedSkills,
      includedModules: p.includedModules,
      entitlementKey: p.entitlementKey,
      isPurchasable: p.isPurchasable,
      featured: p.featured,
      upgradeOfSlug: p.upgradeOfSlug,
      writingCorrections: p.writingCorrections ?? 0,
      tierRank: p.tierRank ?? 0,
      mockTestLimit: p.mockTestLimit ?? 0,
      pastPaperLimit: p.pastPaperLimit ?? 0,
      caseNoteLimit: p.caseNoteLimit ?? 0,
      passPredictor: p.passPredictor ?? false,
      retired: p.retiredAt != null
    };
  }

  /** Public catalogue for the dropdown / homepage catalogue (retired products hidden). */
  async listCatalogue(): Promise<CatalogueProduct[]> {
    const rows = await this.prisma.product.findMany({
      where: { retiredAt: null },
      orderBy: { displayOrder: "asc" }
    });
    return rows.map((r) => this.toCatalogue(r));
  }

  /** Admin catalogue — includes retired products. */
  async listCatalogueForAdmin(): Promise<CatalogueProduct[]> {
    const rows = await this.prisma.product.findMany({ orderBy: { displayOrder: "asc" } });
    return rows.map((r) => this.toCatalogue(r));
  }

  async getBySlug(slug: string): Promise<CatalogueProduct | null> {
    const p = await this.prisma.product.findUnique({ where: { slug } });
    return p ? this.toCatalogue(p) : null;
  }

  private requirePurchasable(product: { status: ProductStatus; isPurchasable: boolean; price: Prisma.Decimal | null; slug: string; name: string }) {
    if (product.status === ProductStatus.COMING_SOON || !product.isPurchasable) {
      throw Object.assign(new Error(`${product.name} is coming soon and cannot be purchased yet`), { statusCode: 403 });
    }
    if (product.price == null) {
      throw Object.assign(new Error(`Pricing for ${product.name} is not configured yet`), { statusCode: 409 });
    }
  }

  // ------------------------------------------------------------- ownership

  /**
   * What the user owns, unified: active product Entitlements PLUS a derived
   * "complete" entitlement when they hold an active Complete Course subscription
   * (non-STARTER). Read-only derivation — does not touch the subscription system.
   */
  async getOwnership(userId: string) {
    const now = new Date();
    const entitlements = await this.prisma.entitlement.findMany({
      where: {
        userId,
        status: "ACTIVE",
        OR: [{ endDate: null }, { endDate: { gt: now } }]
      },
      include: { product: true },
      orderBy: { grantedAt: "desc" }
    });

    const owned = entitlements.map((e) => ({
      entitlementKey: e.entitlementKey,
      productSlug: e.product?.slug ?? null,
      productName: e.product?.name ?? null,
      includedSkills: e.product?.includedSkills ?? [],
      source: e.source,
      startDate: e.startDate?.toISOString() ?? null,
      endDate: e.endDate?.toISOString() ?? null
    }));

    // Per-skill effective access (tier + limits + Pass Predictor). For a skill the
    // user owns via one or more products, keep the strongest tier and the max of
    // each limit. Complete Course (below) grants every skill at full plan limits.
    const skillAccess: Record<string, {
      skill: string; tierRank: number; tierName: string | null;
      mockTestLimit: number; pastPaperLimit: number; caseNoteLimit: number;
      writingCorrections: number; passPredictor: boolean; source: "PRODUCT" | "COMPLETE";
    }> = {};
    const bump = (
      skill: string,
      src: "PRODUCT" | "COMPLETE",
      vals: { tierRank: number; tierName: string | null; mockTestLimit: number; pastPaperLimit: number; caseNoteLimit: number; writingCorrections: number; passPredictor: boolean }
    ) => {
      const cur = skillAccess[skill];
      if (!cur) {
        skillAccess[skill] = { skill, source: src, ...vals };
        return;
      }
      // Complete wins the source label; otherwise keep the higher tier's name.
      const takeName = vals.tierRank >= cur.tierRank ? vals.tierName : cur.tierName;
      skillAccess[skill] = {
        skill,
        source: src === "COMPLETE" || cur.source === "COMPLETE" ? "COMPLETE" : "PRODUCT",
        tierRank: Math.max(cur.tierRank, vals.tierRank),
        tierName: takeName,
        mockTestLimit: Math.max(cur.mockTestLimit, vals.mockTestLimit),
        pastPaperLimit: Math.max(cur.pastPaperLimit, vals.pastPaperLimit),
        caseNoteLimit: Math.max(cur.caseNoteLimit, vals.caseNoteLimit),
        writingCorrections: Math.max(cur.writingCorrections, vals.writingCorrections),
        passPredictor: cur.passPredictor || vals.passPredictor
      };
    };
    for (const e of entitlements) {
      const p = e.product;
      if (!p) continue;
      for (const s of p.includedSkills) {
        bump(s, "PRODUCT", {
          tierRank: p.tierRank ?? 0,
          tierName: (p.tierRank ?? 0) > 0 ? p.name : null,
          mockTestLimit: p.mockTestLimit ?? 0,
          pastPaperLimit: p.pastPaperLimit ?? 0,
          caseNoteLimit: p.caseNoteLimit ?? 0,
          writingCorrections: p.writingCorrections ?? 0,
          passPredictor: p.passPredictor ?? false
        });
      }
    }

    // Derive Complete Course ownership from the active subscription (backward compat).
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "TRIAL"] }, plan: { tier: { not: "STARTER" } } },
      include: { plan: true },
      orderBy: { createdAt: "desc" }
    });
    if (sub && sub.otpVerifiedAt && sub.endDate && sub.endDate > now) {
      owned.unshift({
        entitlementKey: "complete",
        productSlug: "complete",
        productName: `OET Complete Course — ${sub.plan.name}`,
        includedSkills: ["READING", "LISTENING", "WRITING", "SPEAKING"],
        source: "COMPLETE_SUBSCRIPTION",
        startDate: sub.startDate?.toISOString() ?? null,
        endDate: sub.endDate?.toISOString() ?? null
      });
      const plan = sub.plan;
      bump("READING", "COMPLETE", { tierRank: 99, tierName: plan.name, mockTestLimit: plan.readingLimit, pastPaperLimit: plan.pastPaperLimit, caseNoteLimit: 0, writingCorrections: 0, passPredictor: true });
      bump("LISTENING", "COMPLETE", { tierRank: 99, tierName: plan.name, mockTestLimit: plan.listeningLimit, pastPaperLimit: plan.pastPaperLimit, caseNoteLimit: 0, writingCorrections: 0, passPredictor: true });
      bump("WRITING", "COMPLETE", { tierRank: 99, tierName: plan.name, mockTestLimit: 0, pastPaperLimit: plan.pastPaperLimit, caseNoteLimit: 0, writingCorrections: plan.writingLimit, passPredictor: true });
      bump("SPEAKING", "COMPLETE", { tierRank: 99, tierName: plan.name, mockTestLimit: 0, pastPaperLimit: 0, caseNoteLimit: 0, writingCorrections: 0, passPredictor: true });
    }

    const keys = new Set(owned.map((o) => o.entitlementKey));
    const ownedSkills = new Set<string>();
    for (const o of owned) for (const s of o.includedSkills) ownedSkills.add(s);
    const passPredictor = Object.values(skillAccess).some((s) => s.passPredictor);
    return { owned, entitlementKeys: [...keys], ownedSkills: [...ownedSkills], skillAccess, passPredictor };
  }

  async ownsProduct(userId: string, entitlementKey: string): Promise<boolean> {
    const { entitlementKeys } = await this.getOwnership(userId);
    return entitlementKeys.includes(entitlementKey);
  }

  /** Union of skills the user is entitled to across all active products. */
  async getOwnedSkills(userId: string): Promise<string[]> {
    const { ownedSkills } = await this.getOwnership(userId);
    return ownedSkills;
  }

  // ------------------------------------------------------------- checkout

  /**
   * If the user already owns a course that upgrades to `targetSlug`, return the
   * credit = the amount they actually PAID for it (upgrade pays only the difference).
   */
  private async findUpgradeCredit(userId: string, targetSlug: string) {
    const target = await this.prisma.product.findUnique({ where: { slug: targetSlug } });
    // Legacy combos: products that declare targetSlug as their upgrade target.
    const legacySources = await this.prisma.product.findMany({ where: { upgradeOfSlug: targetSlug } });
    // Tier ladder: any lower same-skill tier of the same course counts as an upgrade
    // source, so a Foundation owner buying Mega is credited (not just adjacent tiers).
    let tierSources: typeof legacySources = [];
    if (target && target.tierRank > 0) {
      const targetSkill = target.includedSkills[0];
      tierSources = await this.prisma.product.findMany({
        where: {
          tierRank: { gt: 0, lt: target.tierRank },
          includedSkills: { has: targetSkill }
        }
      });
    }
    const sources = [...legacySources, ...tierSources];
    if (sources.length === 0) return { fromProduct: null as null | { id: string; slug: string; name: string }, credit: 0 };

    const { owned } = await this.getOwnership(userId);
    const ownedSlugs = new Set(owned.map((o) => o.productSlug).filter(Boolean));
    const ownedSources = sources.filter((p) => ownedSlugs.has(p.slug));
    if (ownedSources.length === 0) return { fromProduct: null, credit: 0 };

    // Credit the most valuable lower course the user actually paid for.
    let best: { id: string; slug: string; name: string } | null = null;
    let credit = 0;
    for (const src of ownedSources) {
      const paid = await this.prisma.productPurchase.findFirst({
        where: { userId, productId: src.id, status: "COMPLETED" },
        orderBy: { completedAt: "desc" }
      });
      const c = paid ? Number(paid.amount) : Number(src.price ?? 0);
      if (c >= credit) {
        credit = c;
        best = { id: src.id, slug: src.slug, name: src.name };
      }
    }
    return { fromProduct: best, credit };
  }

  /**
   * Begin a standalone-product purchase. Hard-refuses locked products. If the user
   * is upgrading from a course they own, they pay only the difference (target price
   * − what they actually paid for the owned course). Returns a checkout URL.
   */
  async startCheckout(userId: string, slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });
    this.requirePurchasable(product);

    if (await this.ownsProduct(userId, product.entitlementKey)) {
      throw Object.assign(new Error(`You already own ${product.name}`), { statusCode: 409 });
    }

    const listPrice = Number(product.price);
    const { fromProduct, credit } = await this.findUpgradeCredit(userId, slug);
    const amount = fromProduct ? Math.max(0, Math.round((listPrice - credit) * 100) / 100) : listPrice;

    const purchase = await this.prisma.productPurchase.create({
      data: {
        userId,
        productId: product.id,
        amount,
        currency: product.currency,
        status: "PENDING",
        provider: "STAGING_MANUAL",
        reference: fromProduct ? `upgrade-from-${fromProduct.slug}-${Date.now()}` : `product-${Date.now()}`
      }
    });
    return {
      purchaseId: purchase.id,
      checkoutUrl: `/checkout/product?purchase=${purchase.id}`,
      product: this.toCatalogue(product),
      isUpgrade: Boolean(fromProduct),
      upgradeFrom: fromProduct?.name ?? null,
      listPrice,
      credit: fromProduct ? credit : 0,
      amount
    };
  }

  /** Complete a product purchase (dev bypass / webhook) and grant the entitlement. */
  async resolvePurchase(userId: string, purchaseId: string, status: "COMPLETED" | "FAILED") {
    const purchase = await this.prisma.productPurchase.findFirst({
      where: { id: purchaseId, userId }, include: { product: true }
    });
    if (!purchase) throw Object.assign(new Error("Purchase not found"), { statusCode: 404 });
    if (purchase.status === "COMPLETED") {
      return { ok: true, alreadyCompleted: true };
    }
    if (status === "FAILED") {
      await this.prisma.productPurchase.update({ where: { id: purchase.id }, data: { status: "FAILED" } });
      return { ok: false, status: "FAILED" as const };
    }
    // Re-validate the product is still purchasable at completion time.
    this.requirePurchasable(purchase.product);

    const now = new Date();
    const end = purchase.product.durationDays
      ? new Date(now.getTime() + purchase.product.durationDays * 24 * 60 * 60 * 1000)
      : null;

    await this.prisma.$transaction([
      this.prisma.productPurchase.update({
        where: { id: purchase.id }, data: { status: "COMPLETED", completedAt: now }
      }),
      this.prisma.entitlement.create({
        data: {
          userId,
          productId: purchase.productId,
          entitlementKey: purchase.product.entitlementKey,
          source: "PRODUCT_PURCHASE",
          status: "ACTIVE",
          startDate: now,
          endDate: end,
          productPurchaseId: purchase.id
        }
      })
    ]);
    return { ok: true, status: "COMPLETED" as const, entitlementKey: purchase.product.entitlementKey };
  }

  async getPurchase(userId: string, purchaseId: string) {
    const purchase = await this.prisma.productPurchase.findFirst({
      where: { id: purchaseId, userId }, include: { product: true }
    });
    if (!purchase) throw Object.assign(new Error("Purchase not found"), { statusCode: 404 });
    const amount = Number(purchase.amount);
    const listPrice = Number(purchase.product.price ?? amount);
    const credit = Math.max(0, Math.round((listPrice - amount) * 100) / 100);
    return {
      id: purchase.id,
      status: purchase.status,
      amount,
      currency: purchase.currency,
      isUpgrade: credit > 0,
      listPrice,
      credit,
      product: this.toCatalogue(purchase.product)
    };
  }

  // ------------------------------------------------------------- admin

  /** Admin: update a product's commercial fields (dynamic pricing). */
  async adminUpdateProduct(slug: string, data: {
    price?: number | null; durationDays?: number | null; status?: ProductStatus;
    isPurchasable?: boolean; name?: string; shortDescription?: string | null; featured?: boolean;
    writingCorrections?: number; mockTestLimit?: number; pastPaperLimit?: number;
    caseNoteLimit?: number; passPredictor?: boolean;
  }) {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });
    const nn = (v: number) => Math.max(0, Math.round(v));
    const updated = await this.prisma.product.update({
      where: { slug },
      data: {
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.durationDays !== undefined ? { durationDays: data.durationDays } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.isPurchasable !== undefined ? { isPurchasable: data.isPurchasable } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.shortDescription !== undefined ? { shortDescription: data.shortDescription } : {}),
        ...(data.featured !== undefined ? { featured: data.featured } : {}),
        ...(data.writingCorrections !== undefined ? { writingCorrections: nn(data.writingCorrections) } : {}),
        ...(data.mockTestLimit !== undefined ? { mockTestLimit: nn(data.mockTestLimit) } : {}),
        ...(data.pastPaperLimit !== undefined ? { pastPaperLimit: nn(data.pastPaperLimit) } : {}),
        ...(data.caseNoteLimit !== undefined ? { caseNoteLimit: nn(data.caseNoteLimit) } : {}),
        ...(data.passPredictor !== undefined ? { passPredictor: data.passPredictor } : {})
      }
    });
    return this.toCatalogue(updated);
  }

  /** Admin: list a user's active course entitlements + owned skills. */
  async adminListUserEntitlements(userId: string) {
    return this.getOwnership(userId);
  }

  /**
   * Admin: grant a course to a user (manual access). Idempotent per product.
   * The access window is the product's own durationDays, unless the admin passes
   * an explicit `daysOverride` (so support can give custom-length access).
   */
  async adminGrantProduct(userId: string, slug: string, daysOverride?: number | null) {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product) throw Object.assign(new Error("Product not found"), { statusCode: 404 });
    if (product.category === "COMPLETE") {
      throw Object.assign(new Error("The Complete Course is granted via a plan/subscription, not here."), { statusCode: 400 });
    }
    const now = new Date();
    const days = daysOverride != null && daysOverride > 0 ? Math.round(daysOverride) : product.durationDays;
    const end = days ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000) : null;
    const existing = await this.prisma.entitlement.findFirst({
      where: { userId, entitlementKey: product.entitlementKey }
    });
    if (existing) {
      await this.prisma.entitlement.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", startDate: now, endDate: end, source: "GRANT" }
      });
    } else {
      await this.prisma.entitlement.create({
        data: {
          userId, productId: product.id, entitlementKey: product.entitlementKey,
          source: "GRANT", status: "ACTIVE", startDate: now, endDate: end
        }
      });
    }
    return this.getOwnership(userId);
  }

  /** Admin: revoke a course entitlement from a user (downgrade). */
  async adminRevokeEntitlement(userId: string, entitlementKey: string) {
    await this.prisma.entitlement.updateMany({
      where: { userId, entitlementKey },
      data: { status: "REVOKED", endDate: new Date() }
    });
    return this.getOwnership(userId);
  }
}
