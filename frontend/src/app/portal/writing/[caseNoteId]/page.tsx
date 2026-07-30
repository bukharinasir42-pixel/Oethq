"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { OetWritingExam } from "@/components/exam-writing/oet-writing-exam";
import { WorkspaceAccessDeniedState, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { useSession } from "@/hooks/use-session";
import { writingApi, type WritingCaseNote } from "@/lib/writing-api";

export default function WritingExamPage() {
  const params = useParams<{ caseNoteId: string }>();
  const { profile, token, status, error, refresh } = useSession();
  const [note, setNote] = useState<WritingCaseNote | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !profile) return;
    let cancelled = false;
    writingApi.caseNote(params.caseNoteId)
      .then((n) => { if (!cancelled) setNote(n); })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load this case note"); });
    return () => { cancelled = true; };
  }, [token, profile, params.caseNoteId]);

  if (status === "loading" || status === "idle") return <WorkspaceLoadingState title="Loading writing test…" layout="editor" />;
  if (status === "unauth" || !profile) {
    return <WorkspaceAccessDeniedState title="Portal access required" description={error || "Please log in with your candidate account."} actionHref="/auth/login" actionLabel="Go to login" onRetry={refresh} />;
  }
  if (loadError) {
    return <WorkspaceAccessDeniedState title="Unavailable" description={loadError} actionHref="/portal/writing" actionLabel="Back to Writing" onRetry={refresh} />;
  }
  if (!note) return <WorkspaceLoadingState title="Loading case notes…" layout="editor" />;

  return <OetWritingExam caseNote={note} />;
}
