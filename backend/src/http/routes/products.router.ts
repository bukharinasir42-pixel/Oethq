/**
 * products.router.ts — course catalogue + standalone-product checkout + entitlements.
 * Public catalogue reads; authed checkout/ownership. Mounted at root (/products, /entitlements).
 */
import { Router } from "express";
import { ProductStatus } from "@prisma/client";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth, type AuthedRequest } from "../middleware";

export function createProductsRouter(c: AppContainer): Router {
  const router = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();
  const svc = c.productsService;

  // ---- public catalogue ----
  router.get("/products", asyncHandler(async (_req, res) => {
    res.json({ products: await svc.listCatalogue() });
  }));

  router.get("/products/:slug", asyncHandler(async (req, res) => {
    const product = await svc.getBySlug(String(req.params.slug));
    if (!product) {
      res.status(404).json({ statusCode: 404, message: "Product not found" });
      return;
    }
    res.json(product);
  }));

  // ---- authed: ownership ----
  router.get("/entitlements", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getOwnership((req as AuthedRequest).user.id));
  }));

  // ---- authed: checkout (locked products are hard-refused in the service) ----
  router.post("/products/:slug/checkout", auth, asyncHandler(async (req, res) => {
    res.json(await svc.startCheckout((req as AuthedRequest).user.id, String(req.params.slug)));
  }));

  router.get("/product-purchases/:id", auth, asyncHandler(async (req, res) => {
    res.json(await svc.getPurchase((req as AuthedRequest).user.id, String(req.params.id)));
  }));

  router.post("/product-purchases/:id/resolve", auth, asyncHandler(async (req, res) => {
    const status = req.body?.status === "FAILED" ? "FAILED" : "COMPLETED";
    res.json(await svc.resolvePurchase((req as AuthedRequest).user.id, String(req.params.id), status));
  }));

  // ---- admin: full catalogue (incl. retired) + dynamic pricing ----
  router.get("/admin/products", auth, admin, asyncHandler(async (_req, res) => {
    res.json({ products: await svc.listCatalogueForAdmin() });
  }));

  router.patch("/admin/products/:slug", auth, admin, asyncHandler(async (req, res) => {
    const b = req.body ?? {};
    const status = typeof b.status === "string" && (Object.values(ProductStatus) as string[]).includes(b.status)
      ? (b.status as ProductStatus) : undefined;
    res.json(await svc.adminUpdateProduct(String(req.params.slug), {
      price: b.price === null ? null : b.price != null ? Number(b.price) : undefined,
      durationDays: b.durationDays === null ? null : b.durationDays != null ? Number(b.durationDays) : undefined,
      status,
      isPurchasable: b.isPurchasable != null ? Boolean(b.isPurchasable) : undefined,
      name: typeof b.name === "string" ? b.name : undefined,
      shortDescription: b.shortDescription === null ? null : typeof b.shortDescription === "string" ? b.shortDescription : undefined,
      featured: b.featured != null ? Boolean(b.featured) : undefined,
      writingCorrections: b.writingCorrections != null ? Number(b.writingCorrections) : undefined,
      mockTestLimit: b.mockTestLimit != null ? Number(b.mockTestLimit) : undefined,
      pastPaperLimit: b.pastPaperLimit != null ? Number(b.pastPaperLimit) : undefined,
      caseNoteLimit: b.caseNoteLimit != null ? Number(b.caseNoteLimit) : undefined,
      passPredictor: b.passPredictor != null ? Boolean(b.passPredictor) : undefined
    }));
  }));

  // ---- admin: manage a user's program (upgrade/downgrade) ----
  router.get("/admin/users/:userId/entitlements", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.adminListUserEntitlements(String(req.params.userId)));
  }));

  router.post("/admin/users/:userId/entitlements", auth, admin, asyncHandler(async (req, res) => {
    const days = req.body?.days != null ? Number(req.body.days) : undefined;
    res.json(await svc.adminGrantProduct(String(req.params.userId), String(req.body?.slug), days));
  }));

  router.delete("/admin/users/:userId/entitlements/:key", auth, admin, asyncHandler(async (req, res) => {
    res.json(await svc.adminRevokeEntitlement(String(req.params.userId), String(req.params.key)));
  }));

  return router;
}
