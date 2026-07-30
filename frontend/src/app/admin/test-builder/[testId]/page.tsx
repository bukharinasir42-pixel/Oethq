"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TestBuilderEditor } from "@/components/admin/test-builder-editor";
import { WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import type { TestDetailDto } from "@/lib/types";

export default function EditTestBuilderPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const { token, status } = useSession();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token || !params.testId) {
      if (status !== "loading" && status !== "idle") {
        setReady(true);
      }
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const test = await apiFetch<TestDetailDto>(`/tests/admin/${params.testId}`, { token });
        if (cancelled) return;

        if (test.linkedPastPaper?.id) {
          router.replace(`/admin/past-paper/${test.linkedPastPaper.id}/test/${params.testId}`);
          return;
        }

        setReady(true);
      } catch {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [params.testId, router, status, token]);

  if (!ready) {
    return <WorkspaceLoadingState title="Loading test..." layout="editor" />;
  }

  return <TestBuilderEditor testId={params.testId} initialType="LISTENING" suggestedTitle="" />;
}
