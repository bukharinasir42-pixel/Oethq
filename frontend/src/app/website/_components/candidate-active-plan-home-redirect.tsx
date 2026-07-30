"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";

type SubscriptionStatusDto = {
  accessGranted?: boolean;
  accessExpired?: boolean;
};

/**
 * Marketing routes that active (non-expired) plan candidates must not stay on.
 * They are sent to /portal instead.
 *
 * IMPORTANT: the course/upgrade pages (`/courses/*`) and checkout are deliberately
 * NOT here — an active candidate must be able to reach them to upgrade their tier
 * or buy add-ons (e.g. more writing corrections). Bouncing them off `/courses`
 * previously made every in-portal "upgrade" link flash and dump the user back on
 * the dashboard.
 */
function isMarketingSitePath(pathname: string | null) {
  if (!pathname) return false;
  if (pathname === "/") return true;

  const prefixes = [
    "/about",
    "/stories",
    "/blogs",
    "/website",
    "/contact",
    "/public"
  ];

  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Candidates with an active, non-expired plan cannot use marketing home / child pages.
 */
export function CandidateActivePlanHomeRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { token, profile, status } = useSession();

  useEffect(() => {
    if (!isMarketingSitePath(pathname)) return;
    if (status !== "authed" || !token || !profile || profile.role !== "CANDIDATE") {
      return;
    }

    let cancelled = false;

    void apiFetch<SubscriptionStatusDto>(`/subscriptions/status?userId=${encodeURIComponent(profile.id)}`, {
      token
    })
      .then((sub) => {
        if (cancelled) return;
        // accessGranted is only true when the candidate has a current non-expired plan window.
        if (sub.accessGranted && !sub.accessExpired) {
          router.replace("/portal");
        }
      })
      .catch(() => {
        // Stay on the page if status cannot be loaded.
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, profile, router, status, token]);

  return null;
}
