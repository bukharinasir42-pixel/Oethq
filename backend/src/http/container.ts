import { appConfig } from "../common/app-config";
import { JwtHelper } from "../common/jwt-helper";
import { PrismaService } from "../common/prisma.service";
import { RateLimitService } from "../common/services/rate-limit.service";
import { AuditService } from "../modules/audit/audit.service";
import { AuthService } from "../modules/auth/auth.service";
import { BlogsService } from "../modules/blogs/blogs.service";
import { HowToIntroductionService } from "../modules/how-to-introduction/how-to-introduction.service";
import { WebsiteHomeService } from "../modules/website-home/website-home.service";
import { BunnyPlaybackService } from "../modules/media/bunny-playback.service";
import { EmailService } from "../modules/email/email.service";
import { GradingService } from "../modules/grading/grading.service";
import { StripeService } from "../modules/payments/stripe.service";
import { StorageService } from "../modules/storage/storage.service";
import { SubscriptionsService } from "../modules/subscriptions/subscriptions.service";
import { PastPapersService } from "../modules/past-papers/past-papers.service";
import { TasksService } from "../modules/tasks/tasks.service";
import { CohortService } from "../modules/cohort/cohort.service";
import { CohortJobsService } from "../modules/cohort/cohort-jobs.service";
import { ProductsService } from "../modules/products/products.service";
import { CourseLecturesService } from "../modules/course-lectures/course-lectures.service";
import { PortalResourcesService } from "../modules/portal-resources/portal-resources.service";
import { TestsService } from "../modules/tests/tests.service";
import { OetImportService } from "../modules/tests/oet-import/oet-import.service";
import { SecurityService } from "../modules/security/security.service";
import { SkillDrillsService } from "../modules/skill-drills/skill-drills.service";
import { ReadingArticlesService } from "../modules/reading-articles/reading-articles.service";
import { ListeningPodcastsService } from "../modules/listening-podcasts/listening-podcasts.service";
import { AccountabilityService } from "../modules/accountability/accountability.service";
import { WritingService } from "../modules/writing/writing.service";
import { SpellingService } from "../modules/spelling/spelling.service";
import { UsersService } from "../modules/users/users.service";

export type AppContainer = {
  config: typeof appConfig;
  prisma: PrismaService;
  jwtHelper: JwtHelper;
  rateLimit: RateLimitService;
  emailService: EmailService;
  auditService: AuditService;
  authService: AuthService;
  stripeService: StripeService;
  subscriptionsService: SubscriptionsService;
  usersService: UsersService;
  storageService: StorageService;
  gradingService: GradingService;
  testsService: TestsService;
  pastPapersService: PastPapersService;
  tasksService: TasksService;
  bunnyPlaybackService: BunnyPlaybackService;
  blogsService: BlogsService;
  howToIntroductionService: HowToIntroductionService;
  websiteHomeService: WebsiteHomeService;
  cohortService: CohortService;
  cohortJobsService: CohortJobsService;
  productsService: ProductsService;
  courseLecturesService: CourseLecturesService;
  portalResourcesService: PortalResourcesService;
  oetImportService: OetImportService;
  securityService: SecurityService;
  skillDrillsService: SkillDrillsService;
  readingArticlesService: ReadingArticlesService;
  listeningPodcastsService: ListeningPodcastsService;
  accountabilityService: AccountabilityService;
  writingService: WritingService;
  spellingService: SpellingService;
};

export function createAppContainer(): AppContainer {
  const prisma = new PrismaService();
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_ACCESS_SECRET is required");
  }
  const jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "7d";
  const jwtHelper = new JwtHelper(jwtSecret, jwtAccessExpiresIn);
  const rateLimit = new RateLimitService();
  const emailService = new EmailService(appConfig);
  const auditService = new AuditService(prisma);
  const authService = new AuthService(prisma, jwtHelper, appConfig, emailService, auditService);
  const stripeService = new StripeService(appConfig);
  const subscriptionsService = new SubscriptionsService(prisma, authService, appConfig, auditService, stripeService);
  const usersService = new UsersService(prisma, authService, subscriptionsService, appConfig, auditService);
  const storageService = new StorageService(appConfig, prisma);
  const gradingService = new GradingService();
  const testsService = new TestsService(prisma, gradingService, storageService);
  const pastPapersService = new PastPapersService(prisma);
  const tasksService = new TasksService(prisma, storageService);
  const bunnyPlaybackService = new BunnyPlaybackService(appConfig);
  const blogsService = new BlogsService(prisma, storageService);
  const howToIntroductionService = new HowToIntroductionService(prisma, storageService);
  const websiteHomeService = new WebsiteHomeService(prisma, storageService);

  const sesReady = Boolean(
    process.env.SES_SMTP_HOST && process.env.SES_SMTP_USERNAME && process.env.SES_SMTP_PASSWORD
  );
  const smtpReady = Boolean(process.env.SMTP_HOST && !process.env.SMTP_HOST.includes("example.com"));
  // eslint-disable-next-line no-console
  console.log(
    `[Email] SMTP_MODE=${process.env.SMTP_MODE || "(unset)"} SES=${sesReady ? "ready" : "MISSING"} ElasticEmail=${smtpReady ? "ready" : "off"} FROM=${process.env.SMTP_FROM || "(default)"}`
  );

  const cohortService = new CohortService(prisma, bunnyPlaybackService);
  const cohortJobsService = new CohortJobsService(prisma, emailService, cohortService);
  const productsService = new ProductsService(prisma);
  const courseLecturesService = new CourseLecturesService(prisma, bunnyPlaybackService, productsService);
  const portalResourcesService = new PortalResourcesService(prisma, bunnyPlaybackService, productsService);
  const oetImportService = new OetImportService(prisma, productsService, gradingService, storageService);
  const securityService = new SecurityService(prisma);
  const skillDrillsService = new SkillDrillsService(prisma);
  const readingArticlesService = new ReadingArticlesService(prisma);
  const listeningPodcastsService = new ListeningPodcastsService(prisma, storageService);
  const accountabilityService = new AccountabilityService(prisma, usersService, emailService);
  const writingService = new WritingService(prisma, emailService);
  const spellingService = new SpellingService(prisma);

  return {
    config: appConfig,
    prisma,
    jwtHelper,
    rateLimit,
    emailService,
    auditService,
    authService,
    stripeService,
    subscriptionsService,
    usersService,
    storageService,
    gradingService,
    testsService,
    pastPapersService,
    tasksService,
    bunnyPlaybackService,
    cohortService,
    cohortJobsService,
    productsService,
    courseLecturesService,
    portalResourcesService,
    oetImportService,
    securityService,
    skillDrillsService,
    readingArticlesService,
    listeningPodcastsService,
    accountabilityService,
    writingService,
    spellingService,
    blogsService,
    howToIntroductionService,
    websiteHomeService
  };
}
