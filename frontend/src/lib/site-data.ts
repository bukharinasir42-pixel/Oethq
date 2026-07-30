import type { BlogType } from "./types";

export type PlanTier = "starter" | "foundation" | "accelerator" | "mastery" | "custom";

export type PricingPlan = {
  id: PlanTier;
  purchasePlanId?: string;
  name: string;
  price: string;
  description: string;
  duration: string;
  tests?: {
    reading: number;
    listening: number;
  };
  pastPapers?: number;
  features: string[];
  cta: string;
  badge?: string;
};

export type BlogTeaser = {
  title: string;
  excerpt: string;
  href: string;
  tag: string;
  imageUrl?: string | null;
  /** When set, badge uses category colors (Reading / Speaking / …). */
  blogType?: BlogType;
};

export const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter (Free Trial)",
    price: "Free",
    duration: "5 days · timer starts after OTP verification",
    description: "One-time free trial; Day 1 Daily Lecture only. No tests or past papers.",
    features: [
      "Access: Day 1 Daily Lecture only",
      "No Reading/Listening tests",
      "No past papers",
      "Shown only to logged-in users without an active subscription"
    ],
    cta: "Start Free Trial"
  },
  {
    id: "foundation",
    name: "Foundation",
    price: "$99",
    duration: "60 days · timer starts after OTP verification",
    description: "Starter plan with full lecture/article library and base test counts.",
    tests: { reading: 9, listening: 9 },
    pastPapers: 2,
    features: [
      "All 40 days of Daily Lectures and Articles",
      "9 Reading tests · 9 Listening tests",
      "2 past papers",
      "Timed conditions enforced for all tests"
    ],
    cta: "Choose Foundation"
  },
  {
    id: "accelerator",
    name: "Accelerator",
    price: "$299",
    duration: "60 days · timer starts after OTP verification",
    description: "Expanded test bank with additional past papers.",
    tests: { reading: 13, listening: 13 },
    pastPapers: 4,
    features: [
      "All 40 days of Daily Lectures and Articles",
      "13 Reading tests · 13 Listening tests",
      "4 past papers",
      "Timed conditions enforced for all tests"
    ],
    cta: "Choose Accelerator",
    badge: "Most popular"
  },
  {
    id: "mastery",
    name: "Mastery",
    price: "$399",
    duration: "60 days · timer starts after OTP verification",
    description: "Full inventory for candidates targeting A-grade performance.",
    tests: { reading: 15, listening: 15 },
    pastPapers: 10,
    features: [
      "All 40 days of Daily Lectures and Articles",
      "15 Reading tests · 15 Listening tests",
      "10 past papers",
      "Timed conditions enforced for all tests"
    ],
    cta: "Choose Mastery"
  },
  {
    id: "custom",
    name: "Custom",
    price: "Admin-defined",
    duration: "Dynamic",
    description: "Flexible plan configured by admin (price, description, features).",
    features: [
      "Created by admin with no uniqueness limits",
      "Follows same OTP-based activation",
      "Reading/Listening test counts defined per plan"
    ],
    cta: "Request Custom Plan"
  }
];

export const featureBullets = [
  "One-time purchases — no auto-renewal; renew manually after expiry",
  "60-day subscription timer activates only after the first OTP verification",
  "Listening engine: single-pass audio, no pause/rewind, auto-submit after countdown",
  "Reading engine: Part A auto-submits at 15m; Parts B+C share 45m",
  "N.A.S.I.R. Protocol™ grading shows band labels and pass probability",
  "Paid plans get all 40-day lectures and articles; tests/past papers are plan-gated"
];

export const blogTeasers: BlogTeaser[] = [
  {
    title: "How the N.A.S.I.R. Protocol™ grades your OET practice",
    excerpt: "Understand the score bands (Critical → Elite) and how pass probability is calculated across Reading and Listening.",
    href: "/blogs",
    tag: "Performance"
  },
  {
    title: "Listening module rules — why single-pass audio matters",
    excerpt: "Strict timers, no rewind, and auto-submit after the final extract keep practice aligned to the real exam.",
    href: "/blogs",
    tag: "Listening"
  },
  {
    title: "Daily tasks: lectures and articles across 40 days",
    excerpt: "All paid plans unlock the full lecture and article library; tests scale by plan tier.",
    href: "/blogs",
    tag: "Tasks"
  }
];

export const accessRules = [
  "Free Trial shows only to logged-in users without an active subscription.",
  "A user can use the Free Trial once. If already consumed, hide the Free Trial CTA.",
  "Each purchase is a single 60-day cycle; there is no auto-renewal.",
  "Subscription timer starts at OTP verification time, not at payment time.",
  "Candidates can revisit and retake completed days; the latest score replaces prior attempts."
];
