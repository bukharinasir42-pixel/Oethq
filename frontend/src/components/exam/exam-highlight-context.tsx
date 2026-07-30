"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ExamHighlightContextValue = {
  getSavedHtml: (key: string) => string | undefined;
  saveHtml: (key: string, html: string) => void;
};

const ExamHighlightContext = createContext<ExamHighlightContextValue | null>(null);

type ExamHighlightProviderProps = {
  testId: string;
  children: ReactNode;
};

export function ExamHighlightProvider({ testId, children }: ExamHighlightProviderProps) {
  const [store, setStore] = useState<Record<string, string>>({});

  const getSavedHtml = useCallback(
    (key: string) => store[`${testId}:${key}`],
    [store, testId]
  );

  const saveHtml = useCallback((key: string, html: string) => {
    setStore((current) => ({ ...current, [`${testId}:${key}`]: html }));
  }, [testId]);

  const value = useMemo(() => ({ getSavedHtml, saveHtml }), [getSavedHtml, saveHtml]);

  return <ExamHighlightContext.Provider value={value}>{children}</ExamHighlightContext.Provider>;
}

export function useExamHighlightStore() {
  const ctx = useContext(ExamHighlightContext);
  if (!ctx) {
    throw new Error("useExamHighlightStore must be used within ExamHighlightProvider");
  }
  return ctx;
}

/** Optional store — used when highlighting is enabled outside a provider (e.g. admin preview skips it). */
export function useExamHighlightStoreOptional() {
  return useContext(ExamHighlightContext);
}
