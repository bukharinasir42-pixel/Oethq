import cors from "cors";
import express, { type Request, type Response } from "express";
import morgan from "morgan";
import type { AppContainer } from "./http/container";
import { asyncHandler, httpErrorHandler } from "./http/middleware";
import { auditContextFromRequest } from "./http/request-audit";
import { createAuditRouter } from "./http/routes/audit.router";
import { createAuthRouter } from "./http/routes/auth.router";
import { createBlogsRouter } from "./http/routes/blogs.router";
import { createHowToIntroductionRouter } from "./http/routes/how-to-introduction.router";
import { createWebsiteHomeRouter } from "./http/routes/website-home.router";
import { createGradingRouter } from "./http/routes/grading.router";
import { createPastPapersRouter } from "./http/routes/past-papers.router";
import { createStorageRouter } from "./http/routes/storage.router";
import { createSubscriptionsRouter } from "./http/routes/subscriptions.router";
import { createCohortRouter } from "./http/routes/cohort.router";
import { createProductsRouter } from "./http/routes/products.router";
import { createCourseLecturesRouter } from "./http/routes/course-lectures.router";
import { createPortalResourcesRouter } from "./http/routes/portal-resources.router";
import { createSystemRouter } from "./http/routes/system.router";
import { createTasksRouter } from "./http/routes/tasks.router";
import { createTestsRouter } from "./http/routes/tests.router";
import { createOetTestsRouter } from "./http/routes/oet-tests.router";
import { createSecurityRouter } from "./http/routes/security.router";
import { createSkillDrillsRouter } from "./http/routes/skill-drills.router";
import { createReadingArticlesRouter } from "./http/routes/reading-articles.router";
import { createListeningPodcastsRouter } from "./http/routes/listening-podcasts.router";
import { createAccountabilityRouter } from "./http/routes/accountability.router";
import { createWritingRouter } from "./http/routes/writing.router";
import { createSpellingRouter } from "./http/routes/spelling.router";
import { createUsersRouter } from "./http/routes/users.router";
import { SystemService } from "./system.service";

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

export function createApp(c: AppContainer) {
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

  // Stripe webhook needs the raw body for signature verification — mount before express.json.
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

  const system = new SystemService(c.prisma, c.config);

  /** Mounted at `/auth` so paths are `/auth/login`, etc. (Express 5 nested-router matching). */
  app.use("/auth", createAuthRouter(c));

  const redirectAuthPagesToWebApp = (req: Request, res: Response) => {
    res.redirect(302, `${publicAppOrigin()}${req.originalUrl}`);
  };
  app.get("/auth/login", redirectAuthPagesToWebApp);
  app.get("/auth/register", redirectAuthPagesToWebApp);

  app.use(createSystemRouter(system));
  app.use(createUsersRouter(c));
  app.use(createGradingRouter(c));
  app.use(createTasksRouter(c));
  app.use(createAuditRouter(c));
  app.use(createTestsRouter(c));
  app.use(createOetTestsRouter(c));
  app.use(createSecurityRouter(c));
  app.use(createSkillDrillsRouter(c));
  app.use(createReadingArticlesRouter(c));
  app.use(createListeningPodcastsRouter(c));
  app.use(createAccountabilityRouter(c));
  app.use(createWritingRouter(c));
  app.use(createSpellingRouter(c));
  app.use(createPastPapersRouter(c));
  app.use(createBlogsRouter(c));
  app.use(createHowToIntroductionRouter(c));
  app.use(createWebsiteHomeRouter(c));
  app.use(createStorageRouter(c));
  app.use(createSubscriptionsRouter(c));
  app.use(createCohortRouter(c));
  app.use(createProductsRouter(c));
  app.use(createCourseLecturesRouter(c));
  app.use(createPortalResourcesRouter(c));

  app.use((_req, res) => {
    res.status(404).json({ statusCode: 404, message: "Not found" });
  });

  app.use(httpErrorHandler);

  return app;
}
