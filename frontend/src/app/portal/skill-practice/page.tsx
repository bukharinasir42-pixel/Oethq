"use client";

/**
 * /portal/skill-practice?skill=READING|LISTENING&module=... — the per-skill
 * "core skill improvement" modules (reading-speed drills, Part B/C comprehension,
 * listening spellings, Part C podcasts). Exercises are added later; for now this
 * is a premium "coming soon" placeholder, gated by course ownership.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, Gauge, Podcast, SpellCheck, Target } from "lucide-react";
import { PortalShell } from "@/components/portal/portal-shell";
import { PortalPageHead } from "@/components/portal/portal-primitives";
import { SkillDrillModule } from "@/components/portal/skill-drill-module";
import { ReadingArticleModule } from "@/components/portal/reading-article-module";
import { CheatSheetModule } from "@/components/portal/cheat-sheet-module";
import { ListeningPodcastModule } from "@/components/portal/listening-podcast-module";
import { SpellingModule } from "@/components/portal/spelling-module";
import { PortalUpgradeModal } from "@/components/portal/portal-upgrade-modal";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { usePortalPlanAccess } from "@/hooks/use-portal-plan-access";
import { useSession } from "@/hooks/use-session";
import { moduleUnlockedForTier, type ModuleKey } from "@/lib/portal-tier-access";
import type { SkillKey } from "@/hooks/use-ownership";
import type { LucideIcon } from "lucide-react";

type ModuleDef = {
  skill: SkillKey;
  title: string;
  tagline: string;
  icon: LucideIcon;
  planned: string[];
};

const MODULES: Record<string, ModuleDef> = {
  "part-a-core": {
    skill: "READING",
    title: "Reading Part A — Core Skill Improvement",
    tagline: "Sharpen expeditious reading: skimming, scanning and locating information fast.",
    icon: Gauge,
    planned: [
      "Timed skim-and-scan drills against the clock",
      "Reading-speed builder with words-per-minute tracking",
      "Keyword-matching and heading-location exercises",
      "Progressive difficulty as your speed improves"
    ]
  },
  "part-bc-core": {
    skill: "READING",
    title: "Reading Part B & C — Core Skill Improvement",
    tagline: "A new Daily Live Article from official OET Reading Part C sources — build careful reading for Parts B & C.",
    icon: Target,
    planned: [
      "A fresh Daily Live Article from official OET Part C sources, every day",
      "Written at OET register, length and argument structure",
      "Read for gist, detail, opinion and writer's purpose",
      "Premium magazine typography built for focused reading"
    ]
  },
  spellings: {
    skill: "LISTENING",
    title: "OET Listening Spellings",
    tagline: "Master the medical and everyday spellings that cost easy Part A marks.",
    icon: SpellCheck,
    planned: [
      "Dictation drills for common medical terms",
      "Homophone and tricky-spelling practice sets",
      "Audio-to-text spelling challenges",
      "Personal weak-word list that adapts to your mistakes"
    ]
  },
  "part-c-podcasts": {
    skill: "LISTENING",
    title: "Part C Podcasts",
    tagline: "A new Daily Live Podcast from official OET Listening sources — 10–15 min to train your ear for Part C.",
    icon: Podcast,
    planned: [
      "A fresh Daily Live Podcast from official OET Listening sources, every day",
      "Extended monologues and interviews at exam register",
      "Your listening tracked — a daily tick, streak and running count",
      "Premium player: seek, skip and playback-speed controls"
    ]
  },
  // Cheat sheets apply to BOTH Reading and Listening — the real skill is taken
  // from the ?skill= param (see `skill` below); title/tagline are made skill-aware.
  "cheat-sheets": {
    skill: "READING",
    title: "OET Cheat Sheets",
    tagline: "Downloadable cheat sheets plus how-to lessons on using them in the exam.",
    icon: FileText,
    planned: []
  }
};

function SkillPracticeInner() {
  const params = useSearchParams();
  const rawSkill = params.get("skill")?.toUpperCase();
  const moduleKey = params.get("module") ?? "";
  const def = MODULES[moduleKey];

  const { profile, status, error, refresh, logout } = useSession();
  const { subscription, ownsSkill, planTier, skillAccess, completeExperienceAccess, loading: loadingPlanAccess } = usePortalPlanAccess();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isCheatSheets = moduleKey === "cheat-sheets";
  // Cheat sheets serve both skills → derive skill from the param, not the nominal
  // MODULES entry. Every other module has a fixed skill.
  const skill: SkillKey = isCheatSheets
    ? (rawSkill === "LISTENING" ? "LISTENING" : "READING")
    : def?.skill ?? (rawSkill === "LISTENING" ? "LISTENING" : "READING");
  // Free trial gets exactly the Part A drill + the spelling practice; the rest → upgrade.
  const isFreeTrial = planTier === "STARTER";
  const trialAllowed = isFreeTrial && (moduleKey === "spellings" || moduleKey === "part-a-core");
  // Tier gate: owning the skill isn't enough — the student's course tier must
  // include this module (e.g. cheat sheets require Precision). Complete/trial bypass.
  const tierOk = completeExperienceAccess || moduleUnlockedForTier(skillAccess[skill], moduleKey as ModuleKey);
  const ownsThisSkill = ownsSkill(skill);
  const owned = trialAllowed || (ownsThisSkill && tierOk);
  // Locked because they own the skill but on too low a tier (vs not owning it at all).
  const tierLockedOnly = ownsThisSkill && !tierOk && !trialAllowed;

  const upgradeSkill = useMemo(() => (showUpgrade ? skill : null), [showUpgrade, skill]);

  useEffect(() => {
    // Nothing to fetch yet — content arrives with the future exercises.
  }, []);

  if (status === "loading" || status === "idle" || loadingPlanAccess) {
    return <WorkspaceLoadingState title="Loading practice..." layout="table" />;
  }
  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to view practice."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  if (!def) {
    return (
      <PortalShell title="Practice" description="Skill practice." profile={profile} packageName={subscription?.plan?.name} onRefresh={refresh} onLogout={logout}>
        <div className="rounded-[16px] border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          This practice module isn&apos;t available.
        </div>
      </PortalShell>
    );
  }

  const skillLabel = skill === "READING" ? "Reading" : "Listening";
  const pageTitle = isCheatSheets ? `OET ${skillLabel} Cheat Sheets` : def.title;
  const pageTagline = isCheatSheets
    ? `View and download the ${skillLabel} cheat sheets, then watch how to use them in the exam.`
    : def.tagline;
  const lectureHref = `/portal/lectures?skill=${skill}`;
  const activeSub = profile.subscriptions.find((s) => s.status === "ACTIVE") ?? profile.subscriptions[0];
  const accessUntil = activeSub?.endDate
    ? new Date(activeSub.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;
  const planName = activeSub?.plan?.name ?? subscription?.plan?.name ?? "your plan";

  return (
    <PortalShell
      title={pageTitle}
      description={pageTagline}
      profile={profile}
      packageName={subscription?.plan?.name}
      onRefresh={refresh}
      onLogout={logout}
    >
      <PortalPageHead eyebrow={`${skillLabel} course`} title={pageTitle} description={pageTagline} />

      {!owned ? (
        <section className="card card-pad" style={{ textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>{tierLockedOnly ? `Upgrade your ${skillLabel} tier` : `Unlock the OET ${skillLabel} Course`}</h2>
          <p style={{ maxWidth: 460, margin: "0 auto 18px", color: "var(--text)", lineHeight: 1.6 }}>
            {tierLockedOnly
              ? `${pageTitle} isn't included in your current ${skillLabel} tier. Move up to a higher tier (Precision or Mega) to open it.`
              : `${def.title} is part of the ${skillLabel} course. Add it to your plan to access it the moment it launches.`}
          </p>
          <button className="btn btn-primary" type="button" onClick={() => setShowUpgrade(true)}>{tierLockedOnly ? "Upgrade tier" : "Upgrade to unlock"}</button>
        </section>
      ) : isCheatSheets ? (
        <CheatSheetModule skill={skill === "LISTENING" ? "LISTENING" : "READING"} skillLabel={skillLabel} lectureHref={lectureHref} planName={planName} accessUntil={accessUntil} />
      ) : moduleKey === "spellings" ? (
        <SpellingModule skillLabel={skillLabel} lectureHref={lectureHref} planName={planName} accessUntil={accessUntil} />
      ) : moduleKey === "part-bc-core" ? (
        <ReadingArticleModule
          def={{ title: def.title, tagline: def.tagline, planned: def.planned }}
          skillLabel={skillLabel}
          lectureHref={lectureHref}
          planName={planName}
          accessUntil={accessUntil}
        />
      ) : moduleKey === "part-c-podcasts" ? (
        <ListeningPodcastModule
          def={{ title: def.title, tagline: def.tagline, planned: def.planned }}
          skillLabel={skillLabel}
          lectureHref={lectureHref}
          planName={planName}
          accessUntil={accessUntil}
        />
      ) : (
        <SkillDrillModule
          moduleKey={moduleKey}
          def={{ title: def.title, tagline: def.tagline, planned: def.planned }}
          skillLabel={skillLabel}
          lectureHref={lectureHref}
          planName={planName}
          accessUntil={accessUntil}
        />
      )}

      <PortalUpgradeModal isFreeTrial={isFreeTrial} skill={upgradeSkill} open={showUpgrade} onOpenChange={(v) => { if (!v) setShowUpgrade(false); }} />
    </PortalShell>
  );
}

export default function SkillPracticePage() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Loading practice..." layout="table" />}>
      <SkillPracticeInner />
    </Suspense>
  );
}
