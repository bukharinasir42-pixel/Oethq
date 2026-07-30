"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isExamFormControl } from "./exam-interaction-utils";

type ExamNoCopyProps = {
  children: ReactNode;
  className?: string;
};

function shouldBlockClipboard(event: Event): boolean {
  return !isExamFormControl(event.target);
}

function shouldBlockCopyShortcut(event: KeyboardEvent): boolean {
  if (isExamFormControl(event.target)) return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  const key = event.key.toLowerCase();
  return key === "c" || key === "x" || key === "insert";
}

/** Allows text selection/highlighting but blocks copying exam content (not answer inputs). */
export function ExamNoCopy({ children, className }: ExamNoCopyProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onCopy = (event: ClipboardEvent) => {
      if (shouldBlockClipboard(event)) event.preventDefault();
    };

    const onCut = (event: ClipboardEvent) => {
      if (shouldBlockClipboard(event)) event.preventDefault();
    };

    const onContextMenu = (event: MouseEvent) => {
      if (shouldBlockClipboard(event)) event.preventDefault();
    };

    const onDragStart = (event: DragEvent) => {
      if (shouldBlockClipboard(event)) event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldBlockCopyShortcut(event)) event.preventDefault();
    };

    root.addEventListener("copy", onCopy, true);
    root.addEventListener("cut", onCut, true);
    root.addEventListener("contextmenu", onContextMenu, true);
    root.addEventListener("dragstart", onDragStart, true);
    root.addEventListener("keydown", onKeyDown, true);

    return () => {
      root.removeEventListener("copy", onCopy, true);
      root.removeEventListener("cut", onCut, true);
      root.removeEventListener("contextmenu", onContextMenu, true);
      root.removeEventListener("dragstart", onDragStart, true);
      root.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("exam-no-copy min-h-0 flex-1 flex flex-col", className)}>
      {children}
    </div>
  );
}
