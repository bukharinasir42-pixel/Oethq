"use client";

/**
 * /portal/cohort — merged into "Scheduled Cohort Lectures" (/portal/tasks). This route
 * now redirects there so old links, bookmarks and reminder emails still work.
 * A `?day=N` param is preserved.
 */
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { WorkspaceLoadingState } from "@/components/layout/workspace-states";

function CohortRedirect() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const day = params.get("day");
    router.replace(day ? `/portal/tasks?day=${encodeURIComponent(day)}` : "/portal/tasks");
  }, [router, params]);
  return <WorkspaceLoadingState title="Opening Scheduled Cohort Lectures…" layout="minimal" />;
}

export default function CohortRedirectPage() {
  return (
    <Suspense fallback={<WorkspaceLoadingState title="Opening Scheduled Cohort Lectures…" layout="minimal" />}>
      <CohortRedirect />
    </Suspense>
  );
}
