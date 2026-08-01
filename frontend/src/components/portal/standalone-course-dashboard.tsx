"use client";

/**
 * StandaloneCourseDashboard — the /portal home for a student who owns a
 * standalone course (Reading/Listening) but NOT the Complete Course. Instead of
 * the cohort journey, it surfaces their owned course(s) and every module, plus a
 * locked card + Complete Course upsell for what they don't own.
 */
import Link from "next/link";
import { useState } from "react";
import {
  BookOpen, ClipboardCheck, ClipboardCopy, Gauge, GraduationCap, Headphones, Lock,
  Play, Podcast, SpellCheck, Target, type LucideIcon
} from "lucide-react";
import { SkillUpgradeModal } from "@/components/portal/skill-upgrade-modal";
import { PlansUpgradeModal } from "@/components/portal/plans-upgrade-modal";
import type { SkillKey } from "@/hooks/use-ownership";

type ModuleTile = { label: string; icon: LucideIcon; href: string };

type CourseDef = { skill: SkillKey; name: string; icon: LucideIcon; blurb: string; modules: ModuleTile[] };

const COURSES: CourseDef[] = [
  {
    skill: "READING",
    name: "OET Reading Material",
    icon: BookOpen,
    blurb: "Lectures, practice + mock tests, OET HQ past papers and core-skill drills for Reading.",
    modules: [
      { label: "Lectures", icon: Play, href: "/portal/lectures?skill=READING" },
      { label: "Tests", icon: ClipboardCheck, href: "/portal/course-tests?skill=READING" },
      { label: "Past Papers", icon: ClipboardCopy, href: "/portal/past-papers?skill=READING" },
      { label: "Part A · Core Skills", icon: Gauge, href: "/portal/skill-practice?skill=READING&module=part-a-core" },
      { label: "Part B & C · Core Skills", icon: Target, href: "/portal/skill-practice?skill=READING&module=part-bc-core" }
    ]
  },
  {
    skill: "LISTENING",
    name: "OET Listening Material",
    icon: Headphones,
    blurb: "Lectures, practice + mock tests, OET HQ past papers, spellings and Part C podcasts for Listening.",
    modules: [
      { label: "Lectures", icon: Play, href: "/portal/lectures?skill=LISTENING" },
      { label: "Tests", icon: ClipboardCheck, href: "/portal/course-tests?skill=LISTENING" },
      { label: "Past Papers", icon: ClipboardCopy, href: "/portal/past-papers?skill=LISTENING" },
      { label: "Listening Spellings", icon: SpellCheck, href: "/portal/skill-practice?skill=LISTENING&module=spellings" },
      { label: "Part C Podcasts", icon: Podcast, href: "/portal/skill-practice?skill=LISTENING&module=part-c-podcasts" }
    ]
  }
];

export function StandaloneCourseDashboard({
  profileName,
  ownsSkill
}: {
  profileName?: string | null;
  ownsSkill: (s: SkillKey) => boolean;
}) {
  const [lockedSkill, setLockedSkill] = useState<SkillKey | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const firstName = profileName?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-portal-display text-2xl font-bold text-[hsl(var(--primary-deep))]">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jump straight into your course. Everything you own is unlocked below.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {COURSES.map((course) => {
          const owned = ownsSkill(course.skill);
          const Icon = course.icon;
          if (!owned) {
            return (
              <div key={course.skill} className="flex flex-col rounded-[20px] border border-dashed border-border bg-muted/20 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{course.name}</p>
                    <p className="text-xs text-muted-foreground">Not in your plan yet</p>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{course.blurb}</p>
                <button
                  type="button"
                  onClick={() => setLockedSkill(course.skill)}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-background px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/5"
                >
                  <Lock className="h-4 w-4" aria-hidden /> Unlock this course
                </button>
              </div>
            );
          }
          return (
            <div key={course.skill} className="flex flex-col rounded-[20px] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{course.name}</p>
                  <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--success))]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" aria-hidden /> Owned
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{course.blurb}</p>
              <div className="mt-4 grid gap-2">
                {course.modules.map((m) => {
                  const MIcon = m.icon;
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      className="group flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3.5 py-3 transition hover:border-primary/40 hover:bg-primary/[0.04]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <MIcon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="flex-1 text-sm font-semibold text-foreground">{m.label}</span>
                      <span className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden>→</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Complete Material upsell — unlocks cohort live classes + daily study plan + all skills. */}
      <div className="relative overflow-hidden rounded-[20px] border border-primary/20 bg-primary/5 p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Want the full OET HQ experience?</p>
              <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                Upgrade to the Complete Material for live cohort classes, a guided daily study plan and all four skills.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPlansOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-card)] transition hover:opacity-90"
          >
            View Complete plans
          </button>
        </div>
      </div>

      <SkillUpgradeModal skill={lockedSkill} open={lockedSkill !== null} onOpenChange={(v) => { if (!v) setLockedSkill(null); }} />
      <PlansUpgradeModal open={plansOpen} onOpenChange={setPlansOpen} />
    </div>
  );
}
