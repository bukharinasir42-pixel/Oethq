"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { TestBuilderEditor } from "@/components/admin/test-builder-editor";
import { formatTestDayTitle } from "@/lib/test-builder-utils";

export default function NewTestBuilderPage() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") === "READING" ? "READING" : "LISTENING";
  const suggestedTitle = useMemo(() => {
    const fromQuery = searchParams.get("title")?.trim();
    if (fromQuery) {
      return decodeURIComponent(fromQuery);
    }
    return formatTestDayTitle(initialType, 1);
  }, [initialType, searchParams]);

  return <TestBuilderEditor initialType={initialType} suggestedTitle={suggestedTitle} />;
}
