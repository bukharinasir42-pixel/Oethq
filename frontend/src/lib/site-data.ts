import type { BlogType } from "./types";

export type BlogTeaser = {
  title: string;
  excerpt: string;
  href: string;
  tag: string;
  imageUrl?: string | null;
  /** When set, badge uses category colors (Reading / Speaking / …). */
  blogType?: BlogType;
};

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
