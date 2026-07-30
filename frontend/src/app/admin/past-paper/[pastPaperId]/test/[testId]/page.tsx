"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TestBuilderEditor } from "@/components/admin/test-builder-editor";
import { WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { PastPaperSummaryDto } from "@/lib/types";

export default function PastPaperTestEditorPage() {
  const params = useParams<{ pastPaperId: string; testId: string }>();
  const { token, status } = useSession();
  const [initialType, setInitialType] = useState<"LISTENING" | "READING" | null>(null);

  useEffect(() => {
    if (!token) {
      if (status !== "loading" && status !== "idle") {
        setInitialType("LISTENING");
      }
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const paper = await apiFetch<PastPaperSummaryDto>(`/past-papers/admin/${params.pastPaperId}`, {
          token
        });
        if (cancelled) return;
        setInitialType(paper.readingTest.id === params.testId ? "READING" : "LISTENING");
      } catch {
        if (!cancelled) {
          setInitialType("LISTENING");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [params.pastPaperId, params.testId, status, token]);

  if (!initialType) {
    return <WorkspaceLoadingState title="Loading past paper test..." layout="editor" />;
  }

  return (
    <TestBuilderEditor
      testId={params.testId}
      pastPaperId={params.pastPaperId}
      initialType={initialType}
      suggestedTitle=""
      backHref="/admin/past-paper"
      backLabel="Back to past papers"
      shellTitle="Past Paper"
      shellDescription="Edit listening or reading content for this past paper. Uses the same Test Builder tools as daily practice tests."
    />
  );
}
