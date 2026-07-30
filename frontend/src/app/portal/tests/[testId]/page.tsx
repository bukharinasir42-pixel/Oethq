"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { hasExamResumeProgress } from "@/components/exam/exam-utils";
import { PortalShell } from "@/components/portal/portal-shell";
import { WorkspaceAccessDeniedState, WorkspaceErrorAlert, WorkspaceLoadingState } from "@/components/layout/workspace-states";
import { ReadingTestIntro } from "@/components/test/reading-test-intro";
import { TestRunner } from "@/components/test/test-runner";
import { TestPretestWizard } from "@/components/test/test-pretest-wizard";
import { OetExamRunner } from "@/components/exam-oet/oet-exam-runner";
import { useSession } from "@/hooks/use-session";
import { apiFetch } from "@/lib/api";
import { oetTestsApi, type OetPlayable } from "@/lib/oet-tests-api";
import type { TestAttemptDto, TestDetailDto } from "@/lib/types";

type SubscriptionStatusDto = {
  status: string;
  plan?: { name: string; tier: string };
  expiresInDays?: number;
};

type ExamGate = "loading" | "reading-intro" | "pretest" | "runner";

export default function PortalTestPage() {
  const params = useParams<{ testId: string }>();
  const { token, profile, status, error, refresh, logout } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionStatusDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [test, setTest] = useState<TestDetailDto | null>(null);
  const [examGate, setExamGate] = useState<ExamGate>("loading");
  const [examEntered, setExamEntered] = useState(false);
  // Imported (contentJson) OET tests take over with their own exact-match engine.
  const [oetPlayable, setOetPlayable] = useState<OetPlayable | null>(null);
  const [oetChecked, setOetChecked] = useState(false);

  const testId = params.testId;
  const isExamMode = examGate === "reading-intro" || examGate === "pretest" || examGate === "runner";

  useEffect(() => {
    const load = async () => {
      if (!token || !profile) return;
      try {
        const subscriptionResponse = await apiFetch<SubscriptionStatusDto>(
          `/subscriptions/status?userId=${encodeURIComponent(profile.id)}`,
          { token }
        );
        setSubscription(subscriptionResponse);
      } catch (caughtError: unknown) {
        setLoadError(caughtError instanceof Error ? caughtError.message : "Failed to load subscription status");
      }
    };

    void load();
  }, [token, profile]);

  useEffect(() => {
    if (!token || !testId) return;
    let cancelled = false;

    const load = async () => {
      setGateError(null);
      setExamGate("loading");
      try {
        const [testResponse, attemptResponse] = await Promise.all([
          apiFetch<TestDetailDto>(`/tests/${testId}`, { token }),
          apiFetch<TestAttemptDto | null>(`/tests/${testId}/attempts/current`, { token })
        ]);
        if (cancelled) return;

        setTest(testResponse);

        const resume = hasExamResumeProgress(attemptResponse);
        if (resume) {
          setExamEntered(true);
          setExamGate("runner");
          return;
        }

        if (testResponse.type === "READING") {
          setExamGate("reading-intro");
          return;
        }

        setExamGate("pretest");
      } catch (e: unknown) {
        if (!cancelled) {
          setGateError(e instanceof Error ? e.message : "Failed to prepare test session");
          setExamGate("pretest");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [token, testId]);

  const handleExamEntered = useCallback(() => {
    setExamEntered(true);
    setExamGate("runner");
  }, []);

  // Detect an imported OET test — if so, hand off to the exact-match engine.
  useEffect(() => {
    if (!token || !profile) return;
    let cancelled = false;
    oetTestsApi
      .play(testId)
      .then((p) => { if (!cancelled) setOetPlayable(p); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOetChecked(true); });
    return () => { cancelled = true; };
  }, [token, profile, testId]);

  if (status === "loading" || status === "idle") {
    return <WorkspaceLoadingState title="Loading exam engine..." layout="editor" />;
  }

  if (status === "unauth" || !profile || !token) {
    return (
      <WorkspaceAccessDeniedState
        title="Portal access required"
        description={error || "Please log in with your candidate account to launch the exam engine."}
        actionHref="/auth/login"
        actionLabel="Go to login"
        onRetry={refresh}
      />
    );
  }

  if (!oetChecked) {
    return <WorkspaceLoadingState title="Loading exam…" layout="editor" />;
  }

  if (oetPlayable) {
    return <OetExamRunner testId={testId} playable={oetPlayable} />;
  }

  return (
    <PortalShell
      title="Exam Engine"
      description="Exam mode uses persisted timer state, retained result rules, and exam-condition constraints for Reading and Listening."
      fillContent
      compact={isExamMode}
      hidePageHeader={isExamMode}
      hideSidebar={isExamMode}
      hideWorkspaceHeader={examGate === "reading-intro" || examGate === "runner"}
      profile={profile}
      packageName={subscription?.plan?.name}
      statusLabel={subscription?.status ? `Status: ${subscription.status}` : undefined}
      expiryLabel={
        subscription?.expiresInDays !== undefined ? `${subscription.expiresInDays} days left` : undefined
      }
      onRefresh={refresh}
      onLogout={logout}
    >
      {loadError ? <WorkspaceErrorAlert title="Unable to load subscription status" description={loadError} /> : null}
      {gateError ? <WorkspaceErrorAlert title="Attempt status" description={gateError} /> : null}
      {examGate === "loading" ? (
        <WorkspaceLoadingState title="Preparing your session…" layout="minimal" />
      ) : examGate === "reading-intro" && test && !examEntered ? (
        <ReadingTestIntro
          title={test.title || "Reading Test"}
          partATimer={test.partATimer}
          partBCTimer={test.partBCTimer}
          totalQuestions={test.totalQuestions}
          onStart={handleExamEntered}
          className="min-h-0 flex-1"
        />
      ) : examGate === "pretest" && test && !examEntered ? (
        <div className="relative flex min-h-0 flex-1 flex-col px-4 py-8 sm:px-6">
          <TestPretestWizard token={token} testId={testId} test={test} onBegin={handleExamEntered} />
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          <TestRunner token={token} testId={testId} />
        </div>
      )}
    </PortalShell>
  );
}
