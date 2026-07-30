import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import {
  AttemptSection,
  AttemptStatus,
  BandLabel,
  BlogStatus,
  BlogType,
  PlanTier,
  PrismaClient,
  PurchaseStatus,
  Role,
  SubscriptionStatus,
  TestType
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";
import { buildQuestions } from "../modules/tests/question-templates";

/** Monorepo root `.env`, then `backend/.env` (overrides) — same env resolution as running the API from `backend/`. */
const envRoot = resolve(__dirname, "../../../.env");
const envBackend = resolve(__dirname, "../../.env");
if (existsSync(envRoot)) loadEnv({ path: envRoot });
if (existsSync(envBackend)) loadEnv({ path: envBackend, override: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for seed");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
});

/**
 * Shared test logins for local/staging after `npm run prisma:seed`.
 * Documented in repo README — change here if you rotate passwords.
 */
const SEED_TEST_USERS = {
  admin: { email: "admin@oet.test", password: "Admin@123", name: "OET Admin", role: Role.ADMIN },
  candidate: {
    email: "candidate@oet.test",
    password: "Candidate@123",
    name: "Seed Candidate",
    role: Role.CANDIDATE
  },
  staff: { email: "staff@oet.test", password: "Staff@123", name: "Seed Staff", role: Role.STAFF }
} as const;

async function upsertTest(input: {
  title: string;
  type: TestType;
  description: string;
  instructions: string;
  timerDuration: number;
  partATimer?: number;
  partBCTimer?: number;
  audioAssetId?: string;
}) {
  const existing = await prisma.test.findFirst({
    where: { title: input.title }
  });

  const data = {
    type: input.type,
    title: input.title,
    description: input.description,
    instructions: input.instructions,
    totalQuestions: 42,
    timerDuration: input.timerDuration,
    partATimer: input.partATimer,
    partBCTimer: input.partBCTimer,
    isPublished: true,
    ...(input.audioAssetId
      ? {
          audioAssetId: input.audioAssetId
        }
      : {}),
    questions: {
      create: buildQuestions(input.type)
    }
  };

  if (existing) {
    return prisma.test.update({
      where: { id: existing.id },
      data: {
        ...data,
        questions: {
          deleteMany: {},
          create: buildQuestions(input.type)
        }
      }
    });
  }

  return prisma.test.create({ data });
}

async function main() {
  const { admin: a, candidate: c, staff: s } = SEED_TEST_USERS;

  const adminHash = await bcrypt.hash(a.password, 10);
  const candidateHash = await bcrypt.hash(c.password, 10);
  const staffHash = await bcrypt.hash(s.password, 10);

  const admin = await prisma.user.upsert({
    where: { email: a.email },
    update: {
      name: a.name,
      role: a.role,
      passwordHash: adminHash,
      emailVerifiedAt: new Date()
    },
    create: {
      email: a.email,
      name: a.name,
      role: a.role,
      passwordHash: adminHash,
      emailVerifiedAt: new Date()
    }
  });

  const candidate = await prisma.user.upsert({
    where: { email: c.email },
    update: {
      name: c.name,
      role: c.role,
      passwordHash: candidateHash,
      emailVerifiedAt: new Date()
    },
    create: {
      email: c.email,
      name: c.name,
      role: c.role,
      passwordHash: candidateHash,
      emailVerifiedAt: new Date()
    }
  });

  await prisma.user.upsert({
    where: { email: s.email },
    update: {
      name: s.name,
      role: s.role,
      passwordHash: staffHash,
      emailVerifiedAt: new Date()
    },
    create: {
      email: s.email,
      name: s.name,
      role: s.role,
      passwordHash: staffHash,
      emailVerifiedAt: new Date()
    }
  });

  const plans = [
    {
      name: "Starter (Free Trial)",
      tier: PlanTier.STARTER,
      description: "OTP-gated free trial with Day 1 content only.",
      price: 0,
      readingLimit: 0,
      listeningLimit: 0,
      pastPaperLimit: 0,
      writingLimit: 0,
      durationDays: 7,
      isCustom: false,
      isActive: true
    },
    {
      // Authoritative values reconciled to the running DB + homepage (complete-course-body.ts) on 2026-07-30.
      name: "Foundation Sprint",
      tier: PlanTier.FOUNDATION,
      description: "Self-Paced Foundation",
      price: 187,
      readingLimit: 6,
      listeningLimit: 6,
      pastPaperLimit: 2,
      writingLimit: 2,
      durationDays: 45,
      isCustom: false,
      isActive: true
    },
    {
      name: "Precision Engine",
      tier: PlanTier.ACCELERATOR,
      description: "Fast-Track Your Score",
      price: 331,
      readingLimit: 10,
      listeningLimit: 10,
      pastPaperLimit: 3,
      writingLimit: 3,
      durationDays: 60,
      isCustom: false,
      isActive: true
    },
    {
      name: "Elite Clearance",
      tier: PlanTier.MASTERY,
      description: "Complete Transformation",
      price: 503,
      readingLimit: 15,
      listeningLimit: 15,
      pastPaperLimit: 6,
      writingLimit: 7,
      durationDays: 150,
      isCustom: false,
      isActive: true
    },
    {
      name: "Total Clearance",
      tier: PlanTier.CUSTOM,
      description: "VIP All-Access Pass",
      price: 773,
      readingLimit: 20,
      listeningLimit: 20,
      pastPaperLimit: 10,
      writingLimit: 10,
      durationDays: 270,
      isCustom: true,
      isActive: true
    }
  ];

  for (const plan of plans) {
    const existing = await prisma.plan.findFirst({ where: { tier: plan.tier } });
    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: {
          name: plan.name,
          description: plan.description,
          price: plan.price,
          readingLimit: plan.readingLimit,
          listeningLimit: plan.listeningLimit,
          pastPaperLimit: plan.pastPaperLimit,
          writingLimit: plan.writingLimit,
          durationDays: plan.durationDays,
          isCustom: plan.isCustom,
          isActive: plan.isActive
        }
      });
    } else {
      await prisma.plan.create({ data: plan });
    }
  }

  const starterPlanForDuration = await prisma.plan.findFirst({ where: { tier: PlanTier.STARTER } });
  if (starterPlanForDuration) {
    const starterSubscriptions = await prisma.subscription.findMany({
      where: {
        planId: starterPlanForDuration.id,
        startDate: { not: null }
      }
    });

    for (const subscription of starterSubscriptions) {
      const endDate = new Date(subscription.startDate!);
      endDate.setDate(endDate.getDate() + starterPlanForDuration.durationDays);
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { endDate }
      });
    }
  }

  const blogs = [
    {
      title: "How the N.A.S.I.R. Protocol grades your OET practice",
      description:
        "Understand the score bands (Critical to Elite) and how pass probability is calculated across Reading and Listening.",
      content:
        "Understand the score bands (Critical to Elite) and how pass probability is calculated across Reading and Listening.",
      blogType: BlogType.READING,
      status: BlogStatus.PUBLISHED,
      publishedAt: new Date()
    },
    {
      title: "Listening module rules: single-pass audio and timers",
      description:
        "Strict timers, no rewind, and auto-submit after the final countdown keep practice aligned to the real exam.",
      content:
        "Strict timers, no rewind, and auto-submit after the final countdown keep practice aligned to the real exam.",
      blogType: BlogType.LISTENING,
      status: BlogStatus.PUBLISHED,
      publishedAt: new Date()
    },
    {
      title: "Daily tasks across 40 days",
      description:
        "All paid plans unlock the full lecture and article library; tests scale by plan tier and past paper quota.",
      content:
        "All paid plans unlock the full lecture and article library; tests scale by plan tier and past paper quota.",
      blogType: BlogType.WRITING,
      status: BlogStatus.PUBLISHED,
      publishedAt: new Date()
    }
  ];

  for (const blog of blogs) {
    const existing = await prisma.blog.findFirst({ where: { title: blog.title } });
    if (existing) {
      await prisma.blog.update({ where: { id: existing.id }, data: blog });
    } else {
      await prisma.blog.create({ data: blog });
    }
  }

  const listeningTest = await upsertTest({
    title: "Listening Test 1",
    type: TestType.LISTENING,
    description: "Single-pass listening practice with a final countdown.",
    instructions: "You may listen only once. No pause or rewind is allowed.",
    timerDuration: 50
  });

  const readingTest = await upsertTest({
    title: "Reading Test 1",
    type: TestType.READING,
    description: "Reading Part A followed by Parts B and C with shared timing.",
    instructions: "Part A auto-submits after 15 minutes. Parts B and C share 45 minutes.",
    timerDuration: 60,
    partATimer: 15,
    partBCTimer: 45
  });

  const pastPaper = await upsertTest({
    title: "Past Paper Pack 1",
    type: TestType.READING,
    description: "Past paper practice pack for plan-gated access.",
    instructions: "Use this paper for exam-condition review.",
    timerDuration: 60,
    partATimer: 15,
    partBCTimer: 45
  });

  // Day 1 task (candidate-facing copy). Real published tests are assigned in prod; run `npm run db:seed-mock-demo` locally for asset-backed mock content.
  await prisma.dailyTask.upsert({
    where: { dayNumber: 1 },
    update: {
      title: "Task day 1",
      summary: "Begin with your Day 1 lecture, then sit the timed Reading and Listening practice tests under exam conditions.",
      lectureTitle: "Day 1 Lecture",
      lectureUrl: "https://example.com/lectures/day-1",
      articleTitle: "Day 1 Article",
      articleUrl: "https://example.com/articles/day-1",
      assignedReadingTestId: readingTest.id,
      assignedListeningTestId: listeningTest.id,
      assignedPastPaperTestId: pastPaper.id,
      pastPaperTitle: "Past Paper 1",
      pastPaperUrl: "https://example.com/past-papers/day-1.pdf",
      isPublished: true
    },
    create: {
      dayNumber: 1,
      title: "Task day 1",
      summary: "Begin with your Day 1 lecture, then sit the timed Reading and Listening practice tests under exam conditions.",
      lectureTitle: "Day 1 Lecture",
      lectureUrl: "https://example.com/lectures/day-1",
      articleTitle: "Day 1 Article",
      articleUrl: "https://example.com/articles/day-1",
      assignedReadingTestId: readingTest.id,
      assignedListeningTestId: listeningTest.id,
      assignedPastPaperTestId: pastPaper.id,
      pastPaperTitle: "Past Paper 1",
      pastPaperUrl: "https://example.com/past-papers/day-1.pdf",
      isPublished: true
    }
  });

  const starterPlan = await prisma.plan.findFirst({ where: { tier: PlanTier.STARTER } });
  const foundationPlan = await prisma.plan.findFirst({ where: { tier: PlanTier.FOUNDATION } });

  if (starterPlan) {
    await prisma.subscription.upsert({
      where: {
        userId_planId: {
          userId: admin.id,
          planId: starterPlan.id
        }
      },
      update: {
        status: SubscriptionStatus.TRIAL,
        trialUsed: false,
        startDate: null,
        endDate: null,
        otpVerifiedAt: null
      },
      create: {
        userId: admin.id,
        planId: starterPlan.id,
        status: SubscriptionStatus.TRIAL,
        trialUsed: false
      }
    });
  }

  if (foundationPlan) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + foundationPlan.durationDays);

    await prisma.subscription.upsert({
      where: {
        userId_planId: {
          userId: candidate.id,
          planId: foundationPlan.id
        }
      },
      update: {
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        otpVerifiedAt: startDate,
        trialUsed: true
      },
      create: {
        userId: candidate.id,
        planId: foundationPlan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
        otpVerifiedAt: startDate,
        trialUsed: true
      }
    });

    const resultCompletedAt = new Date();

    await prisma.testResult.upsert({
      where: {
        userId_testId: {
          userId: candidate.id,
          testId: listeningTest.id
        }
      },
      update: {
        latestAttemptId: null,
        score: 30,
        partAScore: 12,
        partBScore: 8,
        partCScore: 10,
        bandLabel: BandLabel.EXCELLENT,
        passProbability: 85,
        completedAt: resultCompletedAt,
        attemptsCount: 2
      },
      create: {
        userId: candidate.id,
        testId: listeningTest.id,
        latestAttemptId: null,
        score: 30,
        partAScore: 12,
        partBScore: 8,
        partCScore: 10,
        bandLabel: BandLabel.EXCELLENT,
        passProbability: 85,
        completedAt: resultCompletedAt,
        attemptsCount: 2
      }
    });

    const existingAttempt = await prisma.testAttempt.findFirst({
      where: {
        userId: candidate.id,
        testId: readingTest.id,
        status: AttemptStatus.IN_PROGRESS
      }
    });

    if (!existingAttempt) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
      const sectionExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);

      await prisma.testAttempt.create({
        data: {
          userId: candidate.id,
          testId: readingTest.id,
          status: AttemptStatus.IN_PROGRESS,
          section: AttemptSection.READING_PART_A,
          expiresAt,
          sectionExpiresAt,
          currentQuestionIndex: 4,
          questionCountAnswered: 4,
          timeRemainingSeconds: 3100,
          answersJson: {
            sample: "in-progress"
          }
        }
      });
    }

    await prisma.purchase.create({
      data: {
        userId: candidate.id,
        planId: foundationPlan.id,
        amount: foundationPlan.price,
        currency: foundationPlan.currency,
        status: PurchaseStatus.COMPLETED,
        provider: "manual",
        reference: "seed-foundation",
        activationToken: `seed-${candidate.id}-foundation`,
        activationUrl: "http://localhost:3000/auth/login?activation=seed-foundation",
        completedAt: new Date(),
        emailSentAt: new Date()
      }
    }).catch(() => undefined);
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete. Test users (see README):");
  for (const u of Object.values(SEED_TEST_USERS)) {
    // eslint-disable-next-line no-console
    console.log(`  ${String(u.role).padEnd(10)} ${u.email} / ${u.password}`);
  }
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
