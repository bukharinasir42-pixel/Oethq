"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { RichTextHtml } from "@/components/editor/rich-text-html";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { isHtmlEmpty } from "@/lib/html";
import { formatTaskDayTitle } from "@/lib/task-day-utils";
import type { TaskItem } from "@/lib/types";

function getArticlePdfUrl(task: TaskItem) {
  return task.articlePdfAsset?.signedUrl?.trim() || task.articlePdfAsset?.publicUrl?.trim() || "";
}

export default function PortalArticlePage() {
  const params = useParams<{ dayNumber: string }>();
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const dayNumber = Number(params.dayNumber);
  const { token, profile, status, error, refresh } = useSession();
  const [task, setTask] = useState<TaskItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token || !profile || !Number.isFinite(dayNumber)) return;
      setLoadError(null);
      try {
        const tasks = await apiFetch<TaskItem[]>(`/tasks/for-user?userId=${encodeURIComponent(profile.id)}`, {
          token
        });
        const match = tasks.find((item) => item.dayNumber === dayNumber) ?? null;
        setTask(match);
        if (!match) {
          setLoadError("This reading passage could not be found.");
        }
      } catch (caught) {
        setLoadError(caught instanceof Error ? caught.message : "Failed to load reading passage");
      }
    };
    void load();
  }, [token, profile, dayNumber]);

  useEffect(() => {
    if (!autoPrint || !task) return;
    const pdfUrl = getArticlePdfUrl(task);
    if (pdfUrl) {
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const timer = window.setTimeout(() => {
      window.print();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [autoPrint, task]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading reading passage..." layout="minimal" />;
  }

  if (status === "unauth" || !profile) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in to read this passage."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-6 py-16">
        <h1 className="font-display text-2xl font-semibold text-[hsl(var(--primary-deep))]">Unable to open passage</h1>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button type="button" variant="outline" className="w-fit" onClick={() => window.close()}>
          Close tab
        </Button>
      </main>
    );
  }

  if (!task) {
    return <WorkspaceLoadingState title="Loading reading passage..." layout="minimal" />;
  }

  if (task.articleLocked) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-6 py-16">
        <h1 className="font-display text-2xl font-semibold text-[hsl(var(--primary-deep))]">Passage locked</h1>
        <p className="text-sm text-muted-foreground">This reading passage unlocks when your plan includes this day.</p>
      </main>
    );
  }

  const title = task.articleTitle?.trim() || formatTaskDayTitle(task.dayNumber);
  const description = task.summary?.trim() || "";
  const pdfUrl = getArticlePdfUrl(task);
  const html = task.articleContent?.trim() || "";
  const hasHtml = Boolean(html) && !isHtmlEmpty(html);

  return (
    <main className="min-h-dvh bg-[hsl(var(--paper,#FDFEFF))] text-[#1A2B45]">
      <div className="print:hidden border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Day {task.dayNumber} · Reading passage
            </p>
            <p className="font-display text-sm font-semibold text-[hsl(var(--primary-deep))]">{title}</p>
          </div>
          <div className="flex gap-2">
            {pdfUrl ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download>
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Download PDF
                </a>
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
                Print / Save PDF
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => window.close()}>
              Close
            </Button>
          </div>
        </div>
      </div>

      <article className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.19em] text-primary">
          Examiner-style passage · Day {task.dayNumber}
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[hsl(var(--primary-deep))] sm:text-4xl">
          {title}
        </h1>
        {description ? <p className="mt-4 text-base leading-relaxed text-muted-foreground">{description}</p> : null}

        <div className="mt-8 border-t border-border pt-8">
          {pdfUrl ? (
            <div className="overflow-hidden rounded-[16px] border border-border bg-card shadow-[var(--shadow-card)]">
              <iframe
                title={title}
                src={`${pdfUrl}#view=FitH`}
                className="h-[min(80vh,900px)] w-full bg-white"
              />
            </div>
          ) : hasHtml ? (
            <RichTextHtml html={html} variant="reading" className="reading-paper-prose" />
          ) : (
            <p className="text-sm text-muted-foreground">No article is available for this day.</p>
          )}
        </div>
      </article>
    </main>
  );
}
