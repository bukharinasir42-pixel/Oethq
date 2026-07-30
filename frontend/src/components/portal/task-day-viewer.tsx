"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Headphones,
  Lock,
  Play,
  type LucideIcon
} from "lucide-react";
import { BunnyVideoPlayer } from "@/components/portal/bunny-video-player";
import { TodaysReadingPassageCard } from "@/components/portal/todays-reading-passage-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTaskDayTitle } from "@/lib/task-day-utils";
import { formatTestDurationMinutes, getOpenItemCount } from "@/lib/portal-utils";
import type { TaskItem, TestSummaryDto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useOwnership, type SkillKey } from "@/hooks/use-ownership";
import { usePortalPlanAccess } from "@/hooks/use-portal-plan-access";
import { SkillUpgradeModal } from "@/components/portal/skill-upgrade-modal";
import { SessionCard } from "@/components/cohort/cohort-classes";
import type { CohortSession } from "@/lib/cohort-api";

type TaskDayViewerProps = {
  selectedTask: TaskItem;
  previousTask: TaskItem | null;
  nextTask: TaskItem | null;
  completedTestIds?: ReadonlySet<string>;
  onSelectDay: (dayNumber: number) => void;
  /** Live cohort sessions for this day (Lecture + Core Skills). When present, the
   *  videos render as scheduled cohort sessions (play-at-time, chat, recording,
   *  catch-up, progress) instead of plain video cards. */
  cohortSessions?: CohortSession[] | null;
  onCohortRefresh?: () => void;
};

const ACCORDION_SECTIONS = ["cheat-sheet"] as const;

export function getAssetPlaybackUrl(task: TaskItem, slot: "lecture" | "article") {
  const asset = slot === "lecture" ? task.lectureAsset : task.articleAsset;
  const fallbackUrl = slot === "lecture" ? task.lectureUrl : task.articleUrl;
  return asset?.signedUrl?.trim() || asset?.publicUrl?.trim() || fallbackUrl?.trim() || "";
}

export function getLectureThumbnailUrl(task: TaskItem) {
  return (
    task.lectureThumbnailAsset?.signedUrl?.trim() ||
    task.lectureThumbnailAsset?.publicUrl?.trim() ||
    ""
  );
}

export function getCoreSkillThumbnailUrl(task: TaskItem) {
  return (
    task.articleThumbnailAsset?.signedUrl?.trim() ||
    task.articleThumbnailAsset?.publicUrl?.trim() ||
    ""
  );
}

function getCheatSheetUrl(task: TaskItem) {
  return (
    task.cheatSheetAsset?.signedUrl?.trim() ||
    task.cheatSheetAsset?.publicUrl?.trim() ||
    ""
  );
}

function LockedOverlay({ label, variant = "inline" }: { label: string; variant?: "inline" | "video" }) {
  if (variant === "video") {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(420px 210px at 50% 20%, rgba(124,196,255,.35), transparent 65%), linear-gradient(180deg, transparent 55%, rgba(4,16,34,.45) 100%)"
          }}
          aria-hidden
        />
        <div className="relative z-[1] flex h-14 w-14 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25 backdrop-blur-sm">
          <Lock className="h-6 w-6 text-white/90" aria-hidden />
        </div>
        <p className="relative z-[1] max-w-[280px] text-sm font-medium leading-relaxed text-white/85">{label}</p>
        <span className="relative z-[1] rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
          Upgrade to unlock
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2.5 rounded-[16px] border border-dashed border-border/80 bg-muted/30 px-5 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/60">
        <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{label}</p>
    </div>
  );
}

export function PracticeTestCard({
  type,
  test,
  locked,
  completed,
  primary,
  onUpgrade
}: {
  type: "READING" | "LISTENING";
  test: TestSummaryDto | null | undefined;
  locked: boolean;
  completed: boolean;
  primary?: boolean;
  /** When set, a locked card becomes a clickable upgrade prompt (skill not owned). */
  onUpgrade?: () => void;
}) {
  const Icon: LucideIcon = type === "READING" ? BookOpen : Headphones;
  const fallbackTitle = type === "READING" ? "Reading Test" : "Listening Test";
  const title = test?.title?.trim() || fallbackTitle;
  const duration = test ? formatTestDurationMinutes(test) : null;
  const available = Boolean(test) && !locked;

  let statusLabel = "Not linked";
  let statusClass = "bg-muted text-muted-foreground";
  if (locked) {
    statusLabel = "Locked";
    statusClass = "bg-muted text-muted-foreground";
  } else if (test && completed) {
    statusLabel = "Completed";
    statusClass = "bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]";
  } else if (test) {
    statusLabel = "Not attempted";
    statusClass = "bg-primary/[0.08] text-primary";
  }

  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-[16px] border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5">
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]",
            type === "READING"
              ? "bg-primary/12 text-primary"
              : "bg-[hsl(199_80%_94%)] text-[hsl(199_72%_38%)] dark:bg-cyan-500/15 dark:text-cyan-300"
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-[hsl(var(--primary-deep))]">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Parts A, B, C
            {duration != null && duration > 0 ? ` · ${duration} min` : ""}
          </p>
          <span
            className={cn(
              "mt-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
              statusClass
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {available && test ? (
        <Button
          asChild
          size="sm"
          variant={primary ? "default" : "outline"}
          className={cn(
            "h-10 w-full shrink-0 cursor-pointer sm:w-auto",
            primary && "shadow-[0_8px_18px_-6px_hsl(var(--primary)/0.55)]"
          )}
        >
          <Link href={`/portal/tests/${test.id}`}>{completed ? "Retake test" : "Begin test"}</Link>
        </Button>
      ) : locked && onUpgrade ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onUpgrade}
          className="h-10 w-full shrink-0 cursor-pointer sm:w-auto"
        >
          <Lock className="mr-1.5 h-3.5 w-3.5" />
          Upgrade
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="h-10 w-full shrink-0 sm:w-auto" disabled>
          <Lock className="mr-1.5 h-3.5 w-3.5" />
          {test ? "Locked" : "Unavailable"}
        </Button>
      )}
    </article>
  );
}

export function LessonVideoCard({
  category,
  title,
  playbackUrl,
  locked,
  externalUrl,
  posterUrl,
  dayNumber,
  bunnyVideoId,
  slot
}: {
  category: "Lecture" | "Core skills";
  title: string;
  playbackUrl: string;
  locked: boolean;
  externalUrl?: string;
  posterUrl?: string;
  dayNumber: number;
  bunnyVideoId?: string | null;
  slot: "lecture" | "coreskill";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  if (locked) {
    const displayTitle = title?.trim() || `${category} session`;

    return (
      <article className="equal-card overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="relative overflow-hidden bg-[linear-gradient(140deg,#134D93_0%,#0C2C55_100%)]">
          <span className="absolute left-0 top-3.5 z-10 rounded-r-lg bg-white px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[hsl(var(--primary-deep))]">
            {category}
          </span>
          <LockedOverlay
            label={`${category} unlocks when your plan includes this day.`}
            variant="video"
          />
        </div>
        <div className="px-4 py-3.5">
          <p className="text-sm font-semibold leading-snug text-[hsl(var(--primary-deep))]">{displayTitle}</p>
        </div>
      </article>
    );
  }

  const startPlayback = async () => {
    if (!playbackUrl || !videoRef.current) return;
    setPlaying(true);
    try {
      await videoRef.current.play();
    } catch {
      // Browser may block autoplay until a second gesture; controls remain available.
    }
  };

  const displayTitle = title?.trim() || `${category} session`;

  return (
    <article className="equal-card group overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]">
      <div className="relative overflow-hidden bg-[linear-gradient(140deg,#134D93_0%,#0C2C55_100%)]">
        <span className="absolute left-0 top-3.5 z-10 rounded-r-lg bg-white px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[hsl(var(--primary-deep))]">
          {category}
        </span>

        {bunnyVideoId ? (
          <BunnyVideoPlayer dayNumber={dayNumber} slot={slot} title={displayTitle} poster={posterUrl} />
        ) : playbackUrl ? (
          <>
            <video
              ref={videoRef}
              className={cn(
                "oet-video-player aspect-video w-full bg-[#0C2C55] object-contain",
                !playing && "absolute inset-0 h-full w-full opacity-0"
              )}
              controls={playing}
              playsInline
              preload="metadata"
              poster={posterUrl || undefined}
              src={playbackUrl}
              onPlay={() => setPlaying(true)}
              onPause={() => {
                if (videoRef.current && videoRef.current.currentTime > 0.2) {
                  setPlaying(true);
                }
              }}
            >
              <track kind="captions" />
            </video>

            {!playing ? (
              <button
                type="button"
                className="relative flex aspect-video w-full cursor-pointer items-center justify-center border-0 bg-transparent"
                aria-label={`Play ${displayTitle}`}
                onClick={() => void startPlayback()}
              >
                {posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={posterUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-90"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(420px 210px at 28% 8%, rgba(124,196,255,.28), transparent 60%), linear-gradient(140deg, #134D93 0%, #0C2C55 100%)"
                    }}
                    aria-hidden
                  />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(12,44,85,.55)_100%)]" aria-hidden />
                <div className="relative z-[1] flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white/95 shadow-[0_8px_24px_rgba(4,16,34,.4)] transition-transform duration-150 group-hover:scale-110">
                  <Play className="ml-0.5 h-[17px] w-[17px] fill-[#0C2C55] text-[#0C2C55]" aria-hidden />
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-[5px] bg-white/20" aria-hidden>
                  <i className="block h-full w-0 bg-gradient-to-r from-[#3FA0F0] to-[#7CC4FF]" />
                </div>
              </button>
            ) : null}
          </>
        ) : (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white/20 text-white">
              <Play className="ml-0.5 h-4 w-4 fill-current" aria-hidden />
            </div>
            {externalUrl ? (
              <Button asChild size="sm" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                <a href={externalUrl} target="_blank" rel="noreferrer">
                  Open link
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <p className="text-xs text-[#B9CEE8]">No video linked for this day yet.</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold leading-snug text-[hsl(var(--primary-deep))]">{displayTitle}</p>
          {playbackUrl ? (
            <Badge
              variant="outline"
              className="border-primary/25 bg-primary/[0.08] text-[10px] font-semibold uppercase tracking-wide text-primary"
            >
              {playing ? "Playing" : "Ready"}
            </Badge>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function TaskDayViewer({
  selectedTask,
  previousTask,
  nextTask,
  completedTestIds,
  onSelectDay,
  cohortSessions,
  onCohortRefresh
}: TaskDayViewerProps) {
  const { ownsSkill, loaded: ownershipLoaded } = useOwnership();
  const { planTier } = usePortalPlanAccess();
  // Free-trial (STARTER) users own no skills, but the cohort Day-1 sample tests
  // are granted to them via backend trial-access. Honour the backend day-lock
  // (selectedTask.reading/listeningLocked) for trials instead of force-locking
  // by skill ownership — otherwise the unlocked Day-1 sample would show locked.
  const isFreeTrial = planTier === "STARTER";
  const lectureSession = cohortSessions?.find((s) => s.slot === "LECTURE");
  const coreSkillSession = cohortSessions?.find((s) => s.slot === "CORE_SKILLS");
  const useCohortSessions = Boolean(lectureSession && coreSkillSession);
  const [lockedSkill, setLockedSkill] = useState<SkillKey | null>(null);
  const readingSkillLocked = ownershipLoaded && !ownsSkill("READING") && !isFreeTrial;
  const listeningSkillLocked = ownershipLoaded && !ownsSkill("LISTENING") && !isFreeTrial;
  const openCount = getOpenItemCount(selectedTask);
  const lectureUrl = getAssetPlaybackUrl(selectedTask, "lecture");
  const lectureThumbnailUrl = getLectureThumbnailUrl(selectedTask);
  const articleUrl = getAssetPlaybackUrl(selectedTask, "article");
  const coreSkillThumbnailUrl = getCoreSkillThumbnailUrl(selectedTask);
  const cheatSheetUrl = getCheatSheetUrl(selectedTask);
  const hasCheatSheet = Boolean(
    selectedTask.cheatSheetAssetId || selectedTask.cheatSheetAsset || cheatSheetUrl
  );
  const totalSteps = hasCheatSheet ? 4 : 3;
  const linkedTests = [selectedTask.readingTest, selectedTask.listeningTest].filter(Boolean).length;
  const readingCompleted = Boolean(
    selectedTask.readingTest?.id && completedTestIds?.has(selectedTask.readingTest.id)
  );
  const listeningCompleted = Boolean(
    selectedTask.listeningTest?.id && completedTestIds?.has(selectedTask.listeningTest.id)
  );

  return (
    <div
      id="task-viewer-top"
      className="flex min-w-0 w-full flex-col overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] tracking-wide",
                openCount > 0
                  ? "border-transparent bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]"
                  : "text-muted-foreground"
              )}
            >
              {openCount > 0 ? "Open" : "Locked"}
            </Badge>
            <span className="text-[11.5px] text-muted-foreground tabular-nums">
              {linkedTests} test{linkedTests === 1 ? "" : "s"} linked
            </span>
          </div>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[hsl(var(--primary-deep))] sm:text-3xl">
            {formatTaskDayTitle(selectedTask.dayNumber)}
          </h2>
          {selectedTask.summary?.trim() ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{selectedTask.summary.trim()}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={!previousTask}
            onClick={() => previousTask && onSelectDay(previousTask.dayNumber)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-none"
            disabled={!nextTask}
            onClick={() => nextTask && onSelectDay(nextTask.dayNumber)}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="px-4 py-4 sm:px-6 sm:py-6">
        <section className="mb-6">
          <div className="mb-4">
            <h3 className="font-display text-xl font-semibold tracking-tight text-[hsl(var(--primary-deep))] sm:text-2xl">
              Today&apos;s live lectures
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {useCohortSessions
                ? "Daily lecture and core skills at your scheduled times — join live with chat, or watch the recording."
                : "Daily lecture and core skills with Dr Nasir Bukhari"}
            </p>
          </div>
          {useCohortSessions && lectureSession && coreSkillSession ? (
            <div className="grid gap-4">
              <SessionCard day={selectedTask.dayNumber} session={lectureSession} onRefresh={() => onCohortRefresh?.()} />
              <SessionCard day={selectedTask.dayNumber} session={coreSkillSession} onRefresh={() => onCohortRefresh?.()} />
            </div>
          ) : (
            <div className="equal-card-grid grid gap-4 md:grid-cols-2">
              <LessonVideoCard
                category="Lecture"
                title={selectedTask.lectureTitle}
                playbackUrl={lectureUrl}
                locked={selectedTask.lectureLocked}
                externalUrl={selectedTask.lectureUrl}
                posterUrl={lectureThumbnailUrl}
                dayNumber={selectedTask.dayNumber}
                bunnyVideoId={selectedTask.lectureBunnyVideoId}
                slot="lecture"
              />
              <LessonVideoCard
                category="Core skills"
                title={selectedTask.articleTitle}
                playbackUrl={articleUrl}
                locked={selectedTask.coreSkillsLocked || selectedTask.articleLocked}
                externalUrl={selectedTask.articleUrl}
                posterUrl={coreSkillThumbnailUrl}
                dayNumber={selectedTask.dayNumber}
                bunnyVideoId={selectedTask.articleBunnyVideoId}
                slot="coreskill"
              />
            </div>
          )}
        </section>

        <section className="mb-6">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[hsl(24_90%_48%)]">
              Step 3 of {totalSteps} · Don&apos;t skip
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-[hsl(var(--primary-deep))] sm:text-2xl">
              Timed practice tests
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">Full exam format, linked to today&apos;s lessons</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <PracticeTestCard
              type="READING"
              test={selectedTask.readingTest}
              locked={selectedTask.readingLocked || readingSkillLocked}
              completed={readingCompleted}
              primary
              onUpgrade={readingSkillLocked ? () => setLockedSkill("READING") : undefined}
            />
            <PracticeTestCard
              type="LISTENING"
              test={selectedTask.listeningTest}
              locked={selectedTask.listeningLocked || listeningSkillLocked}
              completed={listeningCompleted}
              onUpgrade={listeningSkillLocked ? () => setLockedSkill("LISTENING") : undefined}
            />
          </div>
        </section>

        {hasCheatSheet ? (
          <Accordion type="multiple" defaultValue={[...ACCORDION_SECTIONS]} className="w-full space-y-2">
            <AccordionItem
              value="cheat-sheet"
              className="overflow-hidden rounded-[16px] border border-border border-b-0 bg-muted/40 px-4 data-[state=open]:shadow-[var(--shadow-card)]"
            >
              <AccordionTrigger className="py-4 hover:no-underline">
                <span className="flex items-center gap-3 text-left">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                      Step 4 of {totalSteps}
                    </span>
                    <span className="block font-display text-base font-semibold">Cheat Sheet</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      PDF reference sheet for this day
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-5 pt-0">
                {selectedTask.cheatSheetLocked ? (
                  <LockedOverlay label="Cheat sheet unlocks when your plan includes this day." />
                ) : cheatSheetUrl ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/70 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {selectedTask.cheatSheetAsset?.title || "Day cheat sheet"}
                      </p>
                      <p className="text-xs text-muted-foreground">Open or download the PDF</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" className="h-10 cursor-pointer">
                        <a href={cheatSheetUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Open PDF
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="secondary" className="h-10 cursor-pointer">
                        <a href={cheatSheetUrl} download target="_blank" rel="noreferrer">
                          <Download className="mr-1.5 h-3.5 w-3.5" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <LockedOverlay label="Cheat sheet is unavailable right now. Try refreshing." />
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}

        <TodaysReadingPassageCard task={selectedTask} className="mt-6" />
      </div>

      <SkillUpgradeModal skill={lockedSkill} open={lockedSkill !== null} onOpenChange={(v) => { if (!v) setLockedSkill(null); }} />
    </div>
  );
}
