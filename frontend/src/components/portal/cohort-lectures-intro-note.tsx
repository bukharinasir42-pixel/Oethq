"use client";

/**
 * First-visit note for Scheduled Cohort Lectures (/portal/tasks).
 *
 * Four steps, deliberately short — it is a signpost, not a manual. It opens
 * once per student and is then reachable from the "How this works" button, so
 * it never becomes something to dismiss every visit.
 *
 * Dismissal is remembered in localStorage rather than on the user record: it is
 * a UI preference, it needs no migration, and the worst case (a cleared browser)
 * is that a student sees a four-line note a second time.
 */
import { useEffect, useState } from "react";
import { CalendarDays, HelpCircle, Radio, BookOpen, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

const SEEN_KEY = "oethq.cohortLecturesIntro.v1";

const STEPS = [
  {
    icon: CalendarDays,
    title: "Pick your day",
    body: "Use the day picker to open any day of your 40-day plan."
  },
  {
    icon: Radio,
    title: "Join the lecture",
    body: "Join live at your scheduled time, or watch the recording later. Both are here."
  },
  {
    icon: BookOpen,
    title: "Practice lives in your courses",
    body: "Mock tests, past papers, articles and cheat sheets are in your Reading and Listening courses — not on this screen."
  },
  {
    icon: Clock3,
    title: "“Coming soon” means not uploaded yet",
    body: "A day opens as soon as its lecture is added. It is not waiting on a timer or your plan."
  }
];

export function CohortLecturesIntroNote() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Read on mount, not during render — localStorage does not exist on the server.
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // Private mode or storage disabled: skip the auto-open rather than break the page.
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      // Not fatal — the note simply shows again next visit.
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        How this works
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scheduled Cohort Lectures</DialogTitle>
            <DialogDescription>Four things worth knowing before you start.</DialogDescription>
          </DialogHeader>

          <ol className="space-y-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex gap-3">
                <span
                  className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {i + 1}. {title}
                  </p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ol>

          <Button type="button" className="mt-1 w-full" onClick={close}>
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
