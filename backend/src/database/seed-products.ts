/**
 * seed-products.ts — the authoritative course catalogue (Product rows).
 *
 * Single source of truth for the Courses dropdown, homepage catalogue, landing
 * pages, checkout mapping and entitlement mapping. Complete Course stays on the
 * existing Plan/Subscription system and is represented here only as a catalogue
 * entry that links back to the existing /courses experience (it is NOT purchased
 * as a standalone Product).
 *
 * ⚠️ PLACEHOLDER COMMERCIAL VALUES: `price` and `durationDays` on the standalone
 * courses below are PLACEHOLDERS pending real numbers. Replace them (here or via
 * an admin update) before going live. Locked (coming-soon) products carry no
 * price and are never purchasable.
 */
import "../load-env";
import { Prisma, PrismaClient, ProductCategory, ProductStatus } from "@prisma/client";

const asJson = (v: Record<string, unknown> | null): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

const prisma = new PrismaClient();

type SeedProduct = {
  slug: string;
  name: string;
  category: ProductCategory;
  status: ProductStatus;
  displayOrder: number;
  shortDescription: string;
  landingRoute: string | null;
  price: number | null;
  durationDays: number | null;
  includedSkills: string[];
  includedModules: Record<string, unknown> | null;
  entitlementKey: string;
  isPurchasable: boolean;
  featured: boolean;
  upgradeOfSlug: string | null;
  writingCorrections?: number;
  tierRank?: number;
  mockTestLimit?: number;
  pastPaperLimit?: number;
  caseNoteLimit?: number;
  passPredictor?: boolean;
};

// Slugs of the superseded single-skill / combo products, retired in favour of the
// tiered courses below. Kept in the DB (existing owners keep access) but hidden
// from the public catalogue and made non-purchasable.
const RETIRED_SLUGS = ["reading", "listening", "reading-listening"];

/**
 * Builds the four price tiers (Foundation / Momentum / Precision / Mega) for a
 * single-skill course. Reading & Listening share the same shape; Writing differs
 * (letter corrections + case notes instead of mock tests).
 */
function tierProducts(opts: {
  skill: "READING" | "LISTENING" | "WRITING";
  label: string; // "Reading"
  baseOrder: number;
  landingBase: string; // "/courses/reading"
  tiers: Array<{
    key: string; // "foundation"
    name: string; // "Reading Foundation"
    price: number;
    durationDays: number;
    mockTestLimit?: number;
    pastPaperLimit: number;
    caseNoteLimit?: number;
    writingCorrections?: number;
    passPredictor: boolean;
    featured?: boolean;
    short: string;
  }>;
}): SeedProduct[] {
  return opts.tiers.map((t, i) => ({
    slug: `${opts.landingBase.split("/").pop()}-${t.key}`,
    name: `OET ${t.name}`,
    category: ProductCategory.STANDALONE,
    status: ProductStatus.ACTIVE,
    displayOrder: opts.baseOrder + i,
    shortDescription: t.short,
    landingRoute: opts.landingBase,
    price: t.price,
    durationDays: t.durationDays,
    includedSkills: [opts.skill],
    includedModules: null,
    entitlementKey: `${opts.skill.toLowerCase()}_${t.key}`,
    isPurchasable: true,
    featured: Boolean(t.featured),
    // Upgrade ladder (matches this codebase's convention: a product's upgradeOfSlug
    // points to the NEXT-higher product, so owning the lower one credits buying it).
    // The service also credits ANY lower same-skill tier the user actually paid for.
    upgradeOfSlug:
      i === opts.tiers.length - 1 ? null : `${opts.landingBase.split("/").pop()}-${opts.tiers[i + 1].key}`,
    tierRank: i + 1,
    mockTestLimit: t.mockTestLimit ?? 0,
    pastPaperLimit: t.pastPaperLimit,
    caseNoteLimit: t.caseNoteLimit ?? 0,
    writingCorrections: t.writingCorrections ?? 0,
    passPredictor: t.passPredictor
  }));
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: "complete",
    name: "OET Complete Courses",
    category: ProductCategory.COMPLETE,
    status: ProductStatus.ACTIVE,
    displayOrder: 0,
    shortDescription: "Full OET preparation — all four skills, past papers, corrections and analytics.",
    landingRoute: "/courses", // existing Complete Course experience (Foundation / Precision / Elite)
    price: null, // priced by the existing Plan tiers, not as a standalone product
    durationDays: null,
    includedSkills: ["READING", "LISTENING", "WRITING", "SPEAKING"],
    includedModules: { note: "See the Foundation / Precision / Elite packages on /courses." },
    entitlementKey: "complete",
    isPurchasable: false, // purchased via the existing plan checkout, never as a Product
    featured: true,
    upgradeOfSlug: null
  },
  // ---- OET Reading Course — 4 tiers (Foundation / Momentum / Precision / Mega) ----
  ...tierProducts({
    skill: "READING",
    label: "Reading",
    baseOrder: 10,
    landingBase: "/courses/reading",
    tiers: [
      { key: "foundation", name: "Reading Foundation", price: 39, durationDays: 30, mockTestLimit: 4, pastPaperLimit: 1, passPredictor: false, short: "Learn the method, test the method — 4 mock tests + 1 OET HQ past paper on the official interface." },
      { key: "momentum", name: "Reading Momentum", price: 65, durationDays: 40, mockTestLimit: 4, pastPaperLimit: 3, passPredictor: false, short: "Add Part C drills and lectures — 4 mock tests + 3 OET HQ past papers." },
      { key: "precision", name: "Reading Precision", price: 93, durationDays: 60, mockTestLimit: 10, pastPaperLimit: 5, passPredictor: true, featured: true, short: "The full method with the data to prove it — 10 mock tests, 5 past papers, cheat sheets + Pass Predictor." },
      { key: "mega", name: "Reading Mega", price: 139, durationDays: 60, mockTestLimit: 15, pastPaperLimit: 10, passPredictor: true, short: "Every paper we have — 15 mock tests + our full 10 OET HQ Reading past papers." }
    ]
  }),
  // ---- OET Listening Course — 4 tiers ----
  ...tierProducts({
    skill: "LISTENING",
    label: "Listening",
    baseOrder: 20,
    landingBase: "/courses/listening",
    tiers: [
      { key: "foundation", name: "Listening Foundation", price: 39, durationDays: 30, mockTestLimit: 4, pastPaperLimit: 1, passPredictor: false, short: "Learn the method, test the method — 4 mock tests + 1 OET HQ past paper with single-play audio." },
      { key: "momentum", name: "Listening Momentum", price: 65, durationDays: 40, mockTestLimit: 4, pastPaperLimit: 3, passPredictor: false, short: "Add Part C drills and lectures — 4 mock tests + 3 OET HQ past papers." },
      { key: "precision", name: "Listening Precision", price: 93, durationDays: 60, mockTestLimit: 10, pastPaperLimit: 5, passPredictor: true, featured: true, short: "The full method with the data to prove it — 10 mock tests, 5 past papers, spelling, podcasts + Pass Predictor." },
      { key: "mega", name: "Listening Mega", price: 139, durationDays: 60, mockTestLimit: 15, pastPaperLimit: 10, passPredictor: true, short: "Every paper we have — 15 mock tests + our full 10 OET HQ Listening past papers." }
    ]
  }),
  // ---- OET Writing Course — 4 tiers (letter corrections + case notes) ----
  ...tierProducts({
    skill: "WRITING",
    label: "Writing",
    baseOrder: 30,
    landingBase: "/courses/writing",
    tiers: [
      { key: "foundation", name: "Writing Foundation", price: 39, durationDays: 30, writingCorrections: 2, caseNoteLimit: 4, pastPaperLimit: 1, passPredictor: false, short: "Learn the letter, get it marked — 2 human corrections to all 6 criteria + 4 case-note tasks." },
      { key: "momentum", name: "Writing Momentum", price: 65, durationDays: 40, writingCorrections: 4, caseNoteLimit: 8, pastPaperLimit: 3, passPredictor: false, short: "Enough letters to improve — 4 corrections + 8 case-note tasks across professions." },
      { key: "precision", name: "Writing Precision", price: 93, durationDays: 60, writingCorrections: 6, caseNoteLimit: 12, pastPaperLimit: 5, passPredictor: true, featured: true, short: "The full method with the data to prove it — 6 corrections, 12 case-note tasks, cheat sheets + Pass Predictor." },
      { key: "mega", name: "Writing Mega", price: 139, durationDays: 60, writingCorrections: 12, caseNoteLimit: 20, pastPaperLimit: 10, passPredictor: true, short: "12 corrections (cheaper than the 12-pack alone) + our full 20 case-note tasks." }
    ]
  }),
  {
    slug: "writing-corrections-2",
    name: "Writing Corrections — 2 Letters",
    category: ProductCategory.ADDON,
    status: ProductStatus.ACTIVE,
    displayOrder: 40,
    shortDescription: "2 letters marked to official OET Writing criteria.",
    landingRoute: "/courses/writing-corrections",
    price: 28,
    durationDays: 120,
    includedSkills: ["WRITING"],
    includedModules: null,
    entitlementKey: "writing_corrections_2",
    isPurchasable: true,
    featured: false,
    upgradeOfSlug: null,
    writingCorrections: 2
  },
  {
    slug: "writing-corrections-6",
    name: "Writing Corrections — 6 Letters",
    category: ProductCategory.ADDON,
    status: ProductStatus.ACTIVE,
    displayOrder: 41,
    shortDescription: "6 letters marked to official OET Writing criteria.",
    landingRoute: "/courses/writing-corrections",
    price: 77,
    durationDays: 120,
    includedSkills: ["WRITING"],
    includedModules: null,
    entitlementKey: "writing_corrections_6",
    isPurchasable: true,
    featured: true,
    upgradeOfSlug: null,
    writingCorrections: 6
  },
  {
    slug: "writing-corrections-12",
    name: "Writing Corrections — 12 Letters",
    category: ProductCategory.ADDON,
    status: ProductStatus.ACTIVE,
    displayOrder: 42,
    shortDescription: "12 letters marked to official OET Writing criteria.",
    landingRoute: "/courses/writing-corrections",
    price: 147,
    durationDays: 120,
    includedSkills: ["WRITING"],
    includedModules: null,
    entitlementKey: "writing_corrections_12",
    isPurchasable: true,
    featured: false,
    upgradeOfSlug: null,
    writingCorrections: 12
  },
  {
    slug: "speaking-role-plays",
    name: "OET Speaking Role Plays",
    category: ProductCategory.ADDON,
    status: ProductStatus.COMING_SOON,
    displayOrder: 5,
    shortDescription: "Guided speaking role-play practice with structured feedback.",
    landingRoute: null,
    price: null,
    durationDays: null,
    includedSkills: ["SPEAKING"],
    includedModules: null,
    entitlementKey: "speaking_role_plays",
    isPurchasable: false, // locked
    featured: false,
    upgradeOfSlug: null
  }
];

async function main() {
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      create: {
        slug: p.slug,
        name: p.name,
        category: p.category,
        status: p.status,
        displayOrder: p.displayOrder,
        shortDescription: p.shortDescription,
        landingRoute: p.landingRoute,
        price: p.price ?? undefined,
        durationDays: p.durationDays ?? undefined,
        includedSkills: p.includedSkills,
        includedModules: asJson(p.includedModules),
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
        retiredAt: null
      },
      // Never override commercial fields (price/durationDays) once set by an admin;
      // structural/tier fields are seed-controlled and always refreshed.
      update: {
        name: p.name,
        category: p.category,
        status: p.status,
        displayOrder: p.displayOrder,
        shortDescription: p.shortDescription,
        landingRoute: p.landingRoute,
        includedSkills: p.includedSkills,
        includedModules: asJson(p.includedModules),
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
        retiredAt: null
      }
    });
    // eslint-disable-next-line no-console
    console.log(`  product upserted: ${p.slug} (${p.status})`);
  }

  // Retire the superseded single-skill / combo products: hide them from the public
  // catalogue and block new purchases, but keep the rows so existing owners (and
  // their entitlements/purchases) are untouched.
  const now = new Date();
  for (const slug of RETIRED_SLUGS) {
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (!existing) continue;
    await prisma.product.update({
      where: { slug },
      data: { isPurchasable: false, featured: false, retiredAt: existing.retiredAt ?? now, landingRoute: null }
    });
    // eslint-disable-next-line no-console
    console.log(`  product retired: ${slug}`);
  }

  // eslint-disable-next-line no-console
  console.log("Product catalogue seeded.");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
