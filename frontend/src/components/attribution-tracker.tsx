"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getApiBase, getToken } from "@/lib/api";
import { reportVisit } from "@/lib/attribution";

/**
 * Reports one page view per navigation.
 *
 * Mounted inside the root providers so it covers the marketing site and the
 * portal from a single place — a tracker you have to remember to add to each
 * new page is a tracker that is missing from the page that matters.
 *
 * It renders nothing, never blocks a render, and swallows every failure.
 */
function Tracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Deferred to an idle callback: this is reporting, and it must never
    // compete with the page the visitor actually came to read.
    const fire = () => void reportVisit(getApiBase(), getToken());
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (typeof idle === "function") {
      idle(fire);
      return;
    }
    const t = setTimeout(fire, 400);
    return () => clearTimeout(t);
  }, [pathname, searchParams]);

  return null;
}

/**
 * `useSearchParams` forces the nearest boundary to client-side render, and Next
 * fails the build outright if it is not wrapped. The Suspense boundary keeps
 * that cost contained to this null-rendering component instead of dragging
 * every statically generated marketing page out of static generation with it.
 */
export function AttributionTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
