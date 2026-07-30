"use client";

/**
 * ScreenshotGuard — best-effort exam-integrity guard. Drops into a test screen
 * and (while `active`) watches for screenshot ATTEMPTS via keyboard heuristics:
 * PrintScreen, Win+Shift+S (Windows Snip), Cmd+Shift+3/4/5 (macOS). Each attempt
 * records a cumulative account strike; warns on 1–2, and on the 3rd the account
 * is suspended (login blocked) and the student is logged out.
 *
 * NOTE: a browser cannot truly detect an OS screenshot or a phone camera — this
 * is a deterrent, not a guarantee.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { apiFetch, clearToken } from "@/lib/api";

type StrikeResult = { strikes: number; suspended: boolean; limit: number; warningsLeft: number };

export function ScreenshotGuard({ active, context }: { active: boolean; context?: string }) {
  const [warning, setWarning] = useState<StrikeResult | null>(null);
  const [suspended, setSuspended] = useState(false);
  const busy = useRef(false);
  const lastAt = useRef(0);

  const strike = useCallback(async () => {
    const now = Date.now();
    if (busy.current || suspended || now - lastAt.current < 800) return; // debounce bursts
    busy.current = true;
    lastAt.current = now;
    try {
      const res = await apiFetch<StrikeResult>("/security/screenshot-strike", {
        method: "POST",
        body: { context: context ?? "test" }
      });
      setWarning(res);
      if (res.suspended) {
        setSuspended(true);
        // Log out and bounce to login after the message is seen; login is
        // blocked server-side until an admin reinstates the account.
        setTimeout(() => {
          clearToken();
          window.location.href = "/auth/login?suspended=1";
        }, 5000);
      }
    } catch {
      /* network hiccup — ignore this strike rather than falsely suspend */
    } finally {
      busy.current = false;
    }
  }, [context, suspended]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "PrintScreen") {
        void strike();
        try { navigator.clipboard?.writeText(""); } catch { /* ignore */ }
        return;
      }
      // macOS screenshots + Windows snip
      if (e.shiftKey && (e.metaKey || e.ctrlKey) && ["3", "4", "5", "S", "s"].includes(k)) {
        void strike();
      }
    };
    // Some browsers only surface PrintScreen on keyup.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen") {
        void strike();
        try { navigator.clipboard?.writeText(""); } catch { /* ignore */ }
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [active, strike]);

  if (suspended) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-6 text-center backdrop-blur">
        <div className="max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <ShieldAlert className="h-8 w-8" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Account suspended</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Multiple screenshot attempts were detected during your test. For content-security reasons your account has
            been suspended. Please contact support to be reinstated. Signing you out…
          </p>
        </div>
      </div>
    );
  }

  if (warning) {
    const n = warning.strikes;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-6" role="alertdialog" aria-modal="true">
        <div className="max-w-md rounded-2xl bg-white p-7 text-center shadow-2xl">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
            <AlertTriangle className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">Screenshot detected — warning {n} of 2</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Capturing test content isn&apos;t allowed. This is an official warning ({n}/2).
            {" "}
            {warning.warningsLeft > 0
              ? `One more attempt and your account will be suspended.`
              : `Your next attempt will suspend your account.`}
          </p>
          <button
            type="button"
            onClick={() => setWarning(null)}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
          >
            I understand — continue
          </button>
        </div>
      </div>
    );
  }

  return null;
}
