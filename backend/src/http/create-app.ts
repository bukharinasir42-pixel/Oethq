import cors from "cors";
import express, { type Request, type Response } from "express";
import morgan from "morgan";
import { SystemService } from "../system.service";
import type { AppContainer } from "./container";
import { asyncHandler, httpErrorHandler } from "./middleware";
import { auditContextFromRequest } from "./request-audit";
import { createAuditRouter } from "./routes/audit.router";
import { createAuthRouter } from "./routes/auth.router";
import { createBlogsRouter } from "./routes/blogs.router";
import { createHowToIntroductionRouter } from "./routes/how-to-introduction.router";
import { createWebsiteHomeRouter } from "./routes/website-home.router";
import { createGradingRouter } from "./routes/grading.router";
import { createPastPapersRouter } from "./routes/past-papers.router";
import { createStorageRouter } from "./routes/storage.router";
import { createSubscriptionsRouter } from "./routes/subscriptions.router";
import { createCohortRouter } from "./routes/cohort.router";
import { createSystemRouter } from "./routes/system.router";
import { createTasksRouter } from "./routes/tasks.router";
import { createTestsRouter } from "./routes/tests.router";
import { createUsersRouter } from "./routes/users.router";

function publicAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function resolveCorsOrigins(): boolean | string[] {
  const configured =
    process.env.CORS_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (configured.length === 0) return true;
  const localOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
  return [...new Set([...configured, ...localOrigins])];
}

export function createHttpApp(c: AppContainer) {
  const app = express();

  if (process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }

  app.use(
    cors({
      origin: resolveCorsOrigins(),
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-webhook-secret"]
    })
  );

  app.post(
    "/subscriptions/stripe/webhook",
    express.raw({ type: "*/*" }),
    asyncHandler(async (req, res) => {
      const sigHeader = req.headers["stripe-signature"];
      const signature = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader ?? "";
      let event: ReturnType<typeof c.stripeService.constructWebhookEvent>;
      try {
        event = c.stripeService.constructWebhookEvent(req.body, signature);
      } catch {
        res.status(400).json({ error: "Invalid Stripe signature" });
        return;
      }
      await c.subscriptionsService.handleStripeEvent(event, auditContextFromRequest(req));
      res.json({ received: true });
    })
  );

  app.use(express.json({ limit: "12mb" }));

  const morganFormat =
    process.env.MORGAN_FORMAT?.trim() ||
    (process.env.npm_lifecycle_event === "dev" || process.env.npm_lifecycle_event === "start:dev"
      ? "dev"
      : process.env.NODE_ENV === "production"
        ? "combined"
        : "dev");
  app.use(morgan(morganFormat, { stream: process.stdout }));

  const systemService = new SystemService(c.prisma, c.config);

  /** Mounted at `/auth` so paths are `/auth/login`, etc. (Express 5 nested-router matching). */
  app.use("/auth", createAuthRouter(c));

  const redirectAuthPagesToWebApp = (req: Request, res: Response) => {
    res.redirect(302, `${publicAppOrigin()}${req.originalUrl}`);
  };
  app.get("/auth/login", redirectAuthPagesToWebApp);
  app.get("/auth/register", redirectAuthPagesToWebApp);

  app.use(createSystemRouter(systemService));
  app.use(createUsersRouter(c));
  app.use(createGradingRouter(c));
  app.use(createTasksRouter(c));
  app.use(createAuditRouter(c));
  app.use(createTestsRouter(c));
  app.use(createPastPapersRouter(c));
  app.use(createBlogsRouter(c));
  app.use(createHowToIntroductionRouter(c));
  app.use(createWebsiteHomeRouter(c));
  app.use(createStorageRouter(c));
  app.use(createSubscriptionsRouter(c));
  app.use(createCohortRouter(c));

  app.use((_req, res) => {
    res.status(404).json({ statusCode: 404, message: "Not found" });
  });

  app.use(httpErrorHandler);

  return app;
}
