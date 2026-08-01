"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen, ClipboardCheck, ClipboardCopy, ClipboardList, Clock, FileText, Gauge, Headphones,
  History, House, PenLine, Play, Podcast, SpellCheck, Target, TrendingUp, Trophy, type LucideIcon
} from "lucide-react";
import { WorkspaceShellFrame } from "@/components/layout/workspace-shell-frame";
import { PremiumPortalShell } from "@/components/portal/premium-portal-shell";
import { PlansUpgradeModal } from "@/components/portal/plans-upgrade-modal";
import { OnboardingGate } from "@/components/portal/onboarding-gate";
import { SkillUpgradeModal } from "@/components/portal/skill-upgrade-modal";
import { usePortalPlanAccess } from "@/hooks/use-portal-plan-access";
import type { SkillKey } from "@/hooks/use-ownership";
import type { UserProfile } from "@/lib/types";

const baseLinks = [
  { href: "/portal", label: "Dashboard", icon: House },
  { href: "/portal/tasks", label: "Scheduled Cohort Lectures", icon: Clock, requiresComplete: true },
  { href: "/portal/dashboard", label: "Progress", icon: TrendingUp },
  { href: "/portal/results", label: "Results", icon: Trophy },
  { href: "/portal/history", label: "Retake history", icon: History }
] as const;

// Each course group expands to its skill's modules. `module` values map to the
// destination: lectures/tests/past-papers are real pages; the rest are the
// premium skill-practice placeholders (exercises added later).
type CourseModule = { key: string; label: string; icon: LucideIcon; module: string };

const COURSE_GROUPS: { skill: SkillKey; label: string; icon: LucideIcon; modules: CourseModule[] }[] = [
  {
    skill: "READING",
    label: "OET Reading Material",
    icon: BookOpen,
    modules: [
      { key: "lectures", label: "Reading Lectures", icon: Play, module: "lectures" },
      { key: "tests", label: "Reading Tests", icon: ClipboardCheck, module: "tests" },
      { key: "past-papers", label: "Reading Past Papers", icon: ClipboardCopy, module: "past-papers" },
      { key: "cheat-sheets", label: "Reading Cheat Sheets", icon: FileText, module: "cheat-sheets" },
      { key: "part-a-core", label: "Part A · Core Skills", icon: Gauge, module: "part-a-core" },
      { key: "part-bc-core", label: "Part B & C · Core Skills", icon: Target, module: "part-bc-core" }
    ]
  },
  {
    skill: "LISTENING",
    label: "OET Listening Material",
    icon: Headphones,
    modules: [
      { key: "lectures", label: "Listening Lectures", icon: Play, module: "lectures" },
      { key: "tests", label: "Listening Tests", icon: ClipboardCheck, module: "tests" },
      { key: "past-papers", label: "Listening Past Papers", icon: ClipboardCopy, module: "past-papers" },
      { key: "cheat-sheets", label: "Listening Cheat Sheets", icon: FileText, module: "cheat-sheets" },
      { key: "spellings", label: "Listening Spellings", icon: SpellCheck, module: "spellings" },
      { key: "part-c-podcasts", label: "Part C Podcasts", icon: Podcast, module: "part-c-podcasts" }
    ]
  },
  {
    skill: "WRITING",
    label: "OET Writing Course",
    icon: PenLine,
    modules: [
      { key: "lectures", label: "Writing Lectures", icon: Play, module: "lectures" },
      { key: "writing", label: "Writing Corrections", icon: PenLine, module: "writing" }
    ]
  }
];

// Resolve a module to its portal route.
function moduleHref(skill: SkillKey, module: string): string {
  if (module === "lectures") return `/portal/lectures?skill=${skill}`;
  if (module === "tests") return `/portal/course-tests?skill=${skill}`;
  if (module === "past-papers") return `/portal/past-papers?skill=${skill}`;
  if (module === "writing") return "/portal/writing";
  return `/portal/skill-practice?skill=${skill}&module=${module}`;
}

type PortalShellProps = {
  title: string;
  description: string;
  profile: UserProfile;
  planLabel?: string;
  packageName?: string;
  statusLabel?: string;
  expiryLabel?: string;
  examCountdownLabel?: string;
  fillContent?: boolean;
  compact?: boolean;
  hidePageHeader?: boolean;
  hideSidebar?: boolean;
  hideWorkspaceHeader?: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  children: React.ReactNode;
};

export function PortalShell({
  title,
  description,
  profile,
  packageName,
  statusLabel,
  expiryLabel,
  examCountdownLabel,
  fillContent = false,
  compact = false,
  hidePageHeader = false,
  hideSidebar = false,
  hideWorkspaceHeader = false,
  onRefresh,
  onLogout,
  children
}: PortalShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const {
    requiresPlanActivation,
    accessExpired,
    accessGranted,
    completeExperienceAccess,
    subscription,
    isFreeTrial,
    ownsSkill,
    accessDaysLeft,
    loading
  } = usePortalPlanAccess();
  const isHome = pathname === "/portal";
  const isExam = pathname.startsWith("/portal/tests/");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [lockedSkill, setLockedSkill] = useState<SkillKey | null>(null);
  const activeSkillParam = searchParams.get("skill")?.toUpperCase() ?? "";
  const activeModuleParam = searchParams.get("module") ?? "";

  useEffect(() => {
    if (loading) return;
    if (!accessGranted && !requiresPlanActivation) {
      window.location.replace("/#packages");
    }
  }, [accessGranted, loading, requiresPlanActivation]);

  const links = baseLinks;
  // Cohort live classes + Study plan are the Complete Course experience. A
  // standalone-only buyer (no active subscription) sees them locked → the plans
  // (Complete Course) upgrade modal. Free-trial/Complete keep them.
  const isCompleteLocked = (link: (typeof baseLinks)[number]) =>
    "requiresComplete" in link && link.requiresComplete && !completeExperienceAccess && !loading;
  const examFromPastPapers = isExam && searchParams.get("from") === "past-papers";

  const activeHref = (() => {
    if (isExam) {
      return examFromPastPapers ? "/portal/past-papers" : "/portal/tasks";
    }
    const matched = links.find(
      (link) => pathname === link.href || (link.href !== "/portal" && pathname.startsWith(`${link.href}/`))
    );
    return matched?.href || "/portal";
  })();

  const baseNavigation = links.map((link) => {
    const locked = isCompleteLocked(link);
    return {
      href: link.href,
      label: link.label,
      icon: link.icon,
      active: link.href === activeHref && !locked,
      locked,
      onSelect: locked ? () => setUpgradeModalOpen(true) : undefined
    };
  });

  // Premium course groups (Reading / Listening): owned = expandable to its
  // modules (Lectures, Tests, Past Papers + skill drills); not owned = locked
  // with an upgrade popup.
  const courseGroups = COURSE_GROUPS.map((g) => {
    // Free trial can browse the course group so it can reach its ONE sample
    // lecture / reading test / listening test + the Part A drill & spelling.
    // Individual locked items inside each module page raise the flagship upgrade.
    const owned = ownsSkill(g.skill) || isFreeTrial;
    const isActiveModule = (module: string) => {
      const skillMatch = activeSkillParam === g.skill;
      if (module === "lectures") return pathname === "/portal/lectures" && skillMatch;
      if (module === "tests") return pathname === "/portal/course-tests" && skillMatch;
      if (module === "past-papers") return pathname === "/portal/past-papers" && skillMatch;
      return pathname === "/portal/skill-practice" && skillMatch && activeModuleParam === module;
    };
    return {
      href: `/portal/course/${g.skill.toLowerCase()}`,
      label: g.label,
      icon: g.icon,
      active: false,
      locked: !owned,
      onSelect: owned ? undefined : () => setLockedSkill(g.skill),
      children: owned
        ? g.modules.map((m) => ({
            href: moduleHref(g.skill, m.module),
            label: m.label,
            icon: m.icon,
            active: isActiveModule(m.module)
          }))
        : undefined
    };
  });

  // Insert the course groups right after "Scheduled Cohort Lectures".
  const cohortIdx = baseNavigation.findIndex((n) => n.href === "/portal/tasks");
  const navigation =
    cohortIdx >= 0
      ? [...baseNavigation.slice(0, cohortIdx + 1), ...courseGroups, ...baseNavigation.slice(cohortIdx + 1)]
      : [...baseNavigation, ...courseGroups];
  const activeLink = navigation.find((link) => link.active) || links[0];
  // A course-group child (Lectures / Tests / Past Papers / skill drill) can be the
  // active item — surface its group + label in the breadcrumb.
  const activeGroup = courseGroups.find((g) => g.children?.some((c) => c.active));
  const activeChild = activeGroup?.children?.find((c) => c.active);

  const breadcrumbs = isExam
    ? [
        { label: "Dashboard", href: "/portal" },
        examFromPastPapers
          ? { label: "Past papers" }
          : { label: "Scheduled Cohort Lectures", href: "/portal/tasks" },
        { label: "Exam" }
      ]
    : isHome
      ? [...(packageName ? [{ label: packageName }] : []), { label: "Dashboard" }]
      : activeGroup && activeChild
        ? [
            { label: "Dashboard", href: "/portal" },
            { label: activeGroup.label },
            { label: activeChild.label }
          ]
        : [
            { label: "Dashboard", href: "/portal" },
            { label: activeLink.label }
          ];

  // Prefer the true remaining access (course entitlement OR subscription, whichever
  // is longer) so a course student sees their real window, not a lapsed free trial.
  const effectiveCountdown =
    accessDaysLeft != null ? `${accessDaysLeft} day${accessDaysLeft === 1 ? "" : "s"} left` : undefined;
  const headerCountdownLabel = effectiveCountdown ?? examCountdownLabel ?? expiryLabel;
  const badges = [statusLabel].filter(Boolean) as string[];
  const slimPageHeader = !isHome && !isExam && !hidePageHeader;
  const resolvedHidePageHeader = hidePageHeader || isHome;

  let gatedChildren = children;
  if (!loading && requiresPlanActivation) {
    gatedChildren = (
      <div className="rounded-[16px] border border-primary/20 bg-primary/5 px-5 py-6">
        <p className="text-sm font-semibold text-foreground">Activate your purchased plan</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Check your email for the unique activation link and OTP. Your {subscription?.plan?.durationDays || 60}-day
          access window starts only after you verify the code for the first time.
        </p>
        {subscription?.activationUrl ? (
          <a
            href={subscription.activationUrl}
            className="mt-4 inline-flex text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open activation link
          </a>
        ) : null}
      </div>
    );
  } else if (!loading && !accessGranted) {
    // No access at all. A standalone-course owner keeps access via their product
    // entitlement even if a free-trial subscription has expired, so this only
    // fires when the user truly has nothing active.
    gatedChildren = (
      <div className="rounded-[16px] border border-border bg-muted/40 px-5 py-6">
        <p className="text-sm font-semibold text-foreground">Choose a plan to continue</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {accessExpired
            ? "Your access window has ended. Pick a plan on the home page to renew."
            : "You do not have an active plan yet. Redirecting you to available plans…"}
        </p>
      </div>
    );
  }

  // Exam / full-screen modes keep the distraction-free legacy frame; every other
  // portal page uses the premium candidate-portal shell (rail + topbar).
  const useLegacyFrame = hideSidebar || fillContent || hideWorkspaceHeader;

  const contentWrapper = (
    <div className={resolvedHidePageHeader ? "flex min-h-0 min-w-0 flex-1 flex-col" : "portal-page min-w-0"}>
      {gatedChildren}
    </div>
  );

  return (
    <>
      {useLegacyFrame ? (
        <WorkspaceShellFrame
          workspaceLabel="Candidate portal"
          title={title}
          description={description}
          compact={compact}
          profile={profile}
          badges={badges}
          packageName={packageName}
          examCountdownLabel={headerCountdownLabel}
          onUpgradeClick={isFreeTrial ? () => setUpgradeModalOpen(true) : undefined}
          navigation={navigation}
          breadcrumbs={breadcrumbs}
          fillContent={fillContent}
          hidePageHeader={resolvedHidePageHeader}
          hideSidebar={hideSidebar}
          hideWorkspaceHeader={hideWorkspaceHeader}
          slimPageHeader={slimPageHeader}
          usePortalChrome
          onRefresh={onRefresh}
          onLogout={onLogout}
        >
          {contentWrapper}
        </WorkspaceShellFrame>
      ) : (
        <PremiumPortalShell
          profile={profile}
          packageName={packageName}
          breadcrumbs={breadcrumbs}
          countdownLabel={headerCountdownLabel}
          navigation={navigation}
          onRefresh={onRefresh}
          onLogout={onLogout}
        >
          {contentWrapper}
        </PremiumPortalShell>
      )}
      {/* Shared by the free-trial "Upgrade" button and the locked Past papers nav item. */}
      <PlansUpgradeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} />
      <SkillUpgradeModal skill={lockedSkill} open={lockedSkill !== null} onOpenChange={(v) => { if (!v) setLockedSkill(null); }} />
      {/* Mandatory "how to use the course" intro — takes over the portal on first entry. */}
      <OnboardingGate accessGranted={accessGranted && !loading} />
    </>
  );
}
