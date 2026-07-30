"use client";

import { ExamShell } from "@/components/exam/exam-shell";

type TestRunnerProps = {
  token: string;
  testId: string;
};

export function TestRunner({ token, testId }: TestRunnerProps) {
  return <ExamShell token={token} testId={testId} />;
}
