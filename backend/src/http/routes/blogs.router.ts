import { Router } from "express";
import { CreateBlogDto } from "../../modules/blogs/dto/create-blog.dto";
import { PublishBlogDto } from "../../modules/blogs/dto/publish-blog.dto";
import { UpdateBlogDto } from "../../modules/blogs/dto/update-blog.dto";
import type { AppContainer } from "../container";
import { asyncHandler, requireAdmin, requireAuth } from "../middleware";
import { validateDto } from "../validation";

export function createBlogsRouter(c: AppContainer) {
  const r = Router();
  const auth = requireAuth(c.jwtHelper);
  const admin = requireAdmin();

  r.get(
    "/blogs/public",
    asyncHandler(async (req, res) => {
      /** Single-article fetch uses the same path as the list so older processes always match `GET /blogs/public`. */
      const idRaw = req.query.id;
      const byId = typeof idRaw === "string" ? idRaw.trim() : "";
      if (byId) {
        const row = await c.blogsService.getPublishedById(byId);
        if (!row) {
          res.status(404).json({ message: "Blog not found" });
          return;
        }
        res.json(row);
        return;
      }
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
      res.json(await c.blogsService.listPublishedPaginated(page, limit));
    })
  );

  r.get(
    "/blogs/admin",
    auth,
    admin,
    asyncHandler(async (_req, res) => {
      res.json(await c.blogsService.listForAdmin());
    })
  );

  r.get(
    "/blogs/admin/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.blogsService.getForAdmin(req.params.id));
    })
  );

  r.post(
    "/blogs",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(CreateBlogDto, req.body);
      const created = await c.blogsService.create(dto);
      res.status(201).json(created);
    })
  );

  r.patch(
    "/blogs/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(UpdateBlogDto, req.body);
      res.json(await c.blogsService.update(req.params.id, dto));
    })
  );

  r.delete(
    "/blogs/:id",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      res.json(await c.blogsService.remove(req.params.id));
    })
  );

  r.put(
    "/blogs/:id/publish",
    auth,
    admin,
    asyncHandler(async (req, res) => {
      const dto = await validateDto(PublishBlogDto, req.body);
      res.json(await c.blogsService.publish(req.params.id, dto));
    })
  );

  return r;
}
