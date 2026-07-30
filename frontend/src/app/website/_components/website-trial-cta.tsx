"use client";

/**
 * WebsiteTrialCta — the flagship "Free trial" button in the top nav.
 * Leads to account creation and, after email verification + login, hands the
 * user straight to /portal?selectTier=STARTER which activates the 7-day free
 * trial. Hidden once a candidate is signed in (they already have access).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredUser } from "@/lib/api";
import { useSession } from "@/hooks/use-session";

// Account creation -> (verify) -> login -> portal trial hand-off. returnTo is
// pre-encoded so the nested ?selectTier survives the query round-trip.
const TRIAL_HREF = "/auth/register?returnTo=%2Fportal%3FselectTier%3DSTARTER";

export function WebsiteTrialCta({ onNavigate }: { onNavigate?: () => void }) {
  const { token, profile, status } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid a hydration flash; then hide for a signed-in candidate.
  if (!mounted) return null;
  const stored = getStoredUser();
  const loggedInCandidate =
    Boolean(token) &&
    status !== "unauth" &&
    (profile?.role === "CANDIDATE" || (status !== "authed" && stored?.role === "CANDIDATE"));
  if (loggedInCandidate) return null;

  return (
    <Link href={TRIAL_HREF} className="hp-trial-cta" onClick={onNavigate}>
      Free trial
    </Link>
  );
}
