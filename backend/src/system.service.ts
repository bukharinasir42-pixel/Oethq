import type { AppConfig } from "./common/app-config";
import { PurchaseStatus, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "./common/prisma.service";
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: AppConfig
  ) {}

  getLiveness() {
    return {
      ok: true as const,
      service: "oet-lms-backend",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime())
    };
  }

  async getReadiness() {
    const now = new Date().toISOString();

    try {
      await this.prisma.$queryRawUnsafe("SELECT 1");

      return {
        ok: true as const,
        timestamp: now,
        checks: {
          database: "up",
          storageConfigured: this.isStorageConfigured(),
          smtpConfigured: this.isSmtpConfigured()
        }
      };
    } catch (error) {
      return {
        ok: false as const,
        timestamp: now,
        checks: {
          database: error instanceof Error ? error.message : String(error),
          storageConfigured: this.isStorageConfigured(),
          smtpConfigured: this.isSmtpConfigured()
        }
      };
    }
  }

  async getMetricsText() {
    const [
      usersTotal,
      activeSubscriptions,
      expiredSubscriptions,
      purchasesPending,
      purchasesCompleted,
      purchasesFailed,
      publishedTests,
      publishedBlogs
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      this.prisma.subscription.count({ where: { status: SubscriptionStatus.EXPIRED } }),
      this.prisma.purchase.count({ where: { status: PurchaseStatus.PENDING } }),
      this.prisma.purchase.count({ where: { status: PurchaseStatus.COMPLETED } }),
      this.prisma.purchase.count({ where: { status: PurchaseStatus.FAILED } }),
      this.prisma.test.count({ where: { isPublished: true } }),
      this.prisma.blog.count({ where: { status: "PUBLISHED" } })
    ]);

    const lines = [
      "# HELP oet_lms_uptime_seconds Process uptime in seconds.",
      "# TYPE oet_lms_uptime_seconds gauge",
      `oet_lms_uptime_seconds ${Math.round(process.uptime())}`,
      "# HELP oet_lms_users_total Total users.",
      "# TYPE oet_lms_users_total gauge",
      `oet_lms_users_total ${usersTotal}`,
      "# HELP oet_lms_active_subscriptions Total active subscriptions.",
      "# TYPE oet_lms_active_subscriptions gauge",
      `oet_lms_active_subscriptions ${activeSubscriptions}`,
      "# HELP oet_lms_expired_subscriptions Total expired subscriptions.",
      "# TYPE oet_lms_expired_subscriptions gauge",
      `oet_lms_expired_subscriptions ${expiredSubscriptions}`,
      "# HELP oet_lms_purchases_pending Total pending purchases.",
      "# TYPE oet_lms_purchases_pending gauge",
      `oet_lms_purchases_pending ${purchasesPending}`,
      "# HELP oet_lms_purchases_completed Total completed purchases.",
      "# TYPE oet_lms_purchases_completed gauge",
      `oet_lms_purchases_completed ${purchasesCompleted}`,
      "# HELP oet_lms_purchases_failed Total failed purchases.",
      "# TYPE oet_lms_purchases_failed gauge",
      `oet_lms_purchases_failed ${purchasesFailed}`,
      "# HELP oet_lms_tests_published Total published tests.",
      "# TYPE oet_lms_tests_published gauge",
      `oet_lms_tests_published ${publishedTests}`,
      "# HELP oet_lms_blogs_published Total published blogs.",
      "# TYPE oet_lms_blogs_published gauge",
      `oet_lms_blogs_published ${publishedBlogs}`
    ];

    return lines.join("\n");
  }

  private isStorageConfigured() {
    const region =
      this.configService.get<string>("AWS_REGION")?.trim() ||
      this.configService.get<string>("AWS_DEFAULT_REGION")?.trim();
    if (!region) {
      return false;
    }

    const hasExplicitKeys = Boolean(
      this.configService.get<string>("AWS_ACCESS_KEY_ID")?.trim() &&
        this.configService.get<string>("AWS_SECRET_ACCESS_KEY")?.trim()
    );
    const hasMinioEndpoint = Boolean(
      this.configService.get<string>("S3_ENDPOINT")?.trim() ||
        this.configService.get<string>("MINIO_ENDPOINT")?.trim()
    );
    if (hasMinioEndpoint) {
      return hasExplicitKeys;
    }

    return hasExplicitKeys || this.configService.get<string>("NODE_ENV") === "production";
  }

  private isSmtpConfigured() {
    const ethereal = (this.configService.get<string>("SMTP_MODE") ?? "").trim().toLowerCase() === "ethereal";
    if (ethereal) {
      return true;
    }
    const host = this.configService.get<string>("SMTP_HOST")?.trim() || "";
    return Boolean(host && !host.includes("example.com"));
  }
}
