import { apiFetch } from "./api";

export type ProductCategory = "COMPLETE" | "STANDALONE" | "ADDON";
export type ProductStatus = "ACTIVE" | "COMING_SOON";

export type CatalogueProduct = {
  slug: string;
  name: string;
  category: ProductCategory;
  status: ProductStatus;
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
  writingCorrections?: number;
  tierRank: number;
  mockTestLimit: number;
  pastPaperLimit: number;
  caseNoteLimit: number;
  passPredictor: boolean;
  retired: boolean;
};

/** Per-skill effective access derived from the products/subscription a user owns. */
export type SkillAccess = {
  skill: string;
  tierRank: number;
  tierName: string | null;
  mockTestLimit: number;
  pastPaperLimit: number;
  caseNoteLimit: number;
  writingCorrections: number;
  passPredictor: boolean;
  source: "PRODUCT" | "COMPLETE";
};

export type OwnedEntitlement = {
  entitlementKey: string;
  productSlug: string | null;
  productName: string | null;
  includedSkills: string[];
  source: "PRODUCT_PURCHASE" | "COMPLETE_SUBSCRIPTION" | "GRANT";
  startDate: string | null;
  endDate: string | null;
};

export type Ownership = {
  owned: OwnedEntitlement[];
  entitlementKeys: string[];
  ownedSkills: string[];
  skillAccess?: Record<string, SkillAccess>;
  passPredictor?: boolean;
};

export type ProductCheckout = {
  purchaseId: string;
  checkoutUrl: string;
  product: CatalogueProduct;
};

export const productsApi = {
  /** Public catalogue (dropdown / homepage / landing). */
  list: () => apiFetch<{ products: CatalogueProduct[] }>("/products", { token: null }),
  get: (slug: string) => apiFetch<CatalogueProduct>(`/products/${slug}`, { token: null }),
  /** Authenticated: what the signed-in user owns. */
  ownership: () => apiFetch<Ownership>("/entitlements"),
  /** Authenticated: begin a standalone-product purchase (locked products 403). */
  checkout: (slug: string) =>
    apiFetch<ProductCheckout>(`/products/${slug}/checkout`, { method: "POST", body: {} }),
  getPurchase: (id: string) =>
    apiFetch<{ id: string; status: string; amount: number; currency: string; product: CatalogueProduct }>(
      `/product-purchases/${id}`
    ),
  resolve: (id: string, status: "COMPLETED" | "FAILED") =>
    apiFetch<{ ok: boolean; status?: string; entitlementKey?: string; alreadyCompleted?: boolean }>(
      `/product-purchases/${id}/resolve`,
      { method: "POST", body: { status } }
    ),
  // ---- admin ----
  adminUpdate: (slug: string, data: Partial<{ price: number | null; durationDays: number | null; status: string; isPurchasable: boolean; name: string; shortDescription: string | null; featured: boolean; writingCorrections: number; mockTestLimit: number; pastPaperLimit: number; caseNoteLimit: number; passPredictor: boolean }>) =>
    apiFetch<CatalogueProduct>(`/admin/products/${slug}`, { method: "PATCH", body: data }),
  /** Admin: full catalogue incl. retired products. */
  adminList: () => apiFetch<{ products: CatalogueProduct[] }>("/admin/products"),
  adminUserEntitlements: (userId: string) => apiFetch<Ownership>(`/admin/users/${userId}/entitlements`),
  adminGrant: (userId: string, slug: string, days?: number) =>
    apiFetch<Ownership>(`/admin/users/${userId}/entitlements`, { method: "POST", body: { slug, ...(days != null ? { days } : {}) } }),
  adminRevoke: (userId: string, entitlementKey: string) =>
    apiFetch<Ownership>(`/admin/users/${userId}/entitlements/${entitlementKey}`, { method: "DELETE" }),

  /**
   * Admin: move a candidate onto a different Complete Course plan. Takes effect
   * immediately — an already-activated student is not asked to re-verify by OTP.
   * `days` overrides the new plan's own duration.
   */
  adminChangePlan: (userId: string, planId: string, days?: number) =>
    apiFetch<{ subscriptionId: string; plan: { id: string; name: string; tier: string }; status: string; startDate: string | null; endDate: string | null }>(
      `/admin/users/${userId}/plan`,
      { method: "POST", body: { planId, ...(days != null ? { days } : {}) } }
    ),

  /** Admin: end the Complete Course plan. Course entitlements are left alone. */
  adminCancelPlan: (userId: string) =>
    apiFetch<{ cancelled: number }>(`/admin/users/${userId}/plan`, { method: "DELETE" })
};
