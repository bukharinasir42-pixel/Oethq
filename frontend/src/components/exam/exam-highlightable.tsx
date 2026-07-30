"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  findHighlightMark,
  getHighlightContentRoot,
  isExamFormControl,
  rangeIntersectsFormControl,
  unwrapHighlight,
  wrapRangeWithHighlight
} from "./exam-interaction-utils";
import { useExamHighlightStoreOptional } from "./exam-highlight-context";

type SelectionPopover = {
  type: "selection";
  x: number;
  y: number;
};

type RemovePopover = {
  type: "remove";
  mark: HTMLElement;
  x: number;
  y: number;
};

type PopoverState = SelectionPopover | RemovePopover;

type ExamHighlightableProps = {
  highlightKey: string;
  children: ReactNode;
  className?: string;
  /** Use span instead of div (inline prompts). */
  inline?: boolean;
  /** Persist highlights when navigating away (default true). */
  persist?: boolean;
};

export function ExamHighlightable({
  highlightKey,
  children,
  className,
  inline = false,
  persist = true
}: ExamHighlightableProps) {
  const containerRef = useRef<HTMLDivElement & HTMLSpanElement>(null);
  const pendingRangeRef = useRef<Range | null>(null);
  const store = useExamHighlightStoreOptional();
  const getSavedHtml = store?.getSavedHtml ?? (() => undefined);
  const saveHtml = store?.saveHtml ?? (() => {});
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const persistContent = useCallback(() => {
    if (!persist) return;
    const container = containerRef.current;
    if (!container) return;
    const root = getHighlightContentRoot(container);
    if (root) saveHtml(highlightKey, root.innerHTML);
  }, [highlightKey, persist, saveHtml]);

  const restoreContent = useCallback(() => {
    if (!persist) return;
    const container = containerRef.current;
    if (!container) return;
    const saved = getSavedHtml(highlightKey);
    if (!saved) return;
    const root = getHighlightContentRoot(container);
    if (root) root.innerHTML = saved;
  }, [getSavedHtml, highlightKey, persist]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => restoreContent());
    return () => window.cancelAnimationFrame(frame);
  }, [highlightKey, children, restoreContent]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseUp = (event: MouseEvent) => {
      if (isExamFormControl(event.target)) return;
      if ((event.target as HTMLElement).closest("[data-exam-highlight-popover]")) return;

      const existingMark = findHighlightMark(event.target, container);
      if (existingMark) {
        const rect = existingMark.getBoundingClientRect();
        pendingRangeRef.current = null;
        setPopover({
          type: "remove",
          mark: existingMark,
          x: rect.left + rect.width / 2,
          y: rect.top
        });
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        pendingRangeRef.current = null;
        setPopover(null);
        return;
      }

      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) {
        pendingRangeRef.current = null;
        setPopover(null);
        return;
      }
      if (rangeIntersectsFormControl(range, container)) {
        pendingRangeRef.current = null;
        setPopover(null);
        selection.removeAllRanges();
        return;
      }

      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      pendingRangeRef.current = range.cloneRange();
      setPopover({
        type: "selection",
        x: rect.left + rect.width / 2,
        y: rect.top
      });
    };

    container.addEventListener("mouseup", onMouseUp);
    return () => container.removeEventListener("mouseup", onMouseUp);
  }, []);

  useEffect(() => {
    if (!popover) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-exam-highlight-popover]")) return;
      pendingRangeRef.current = null;
      setPopover(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [popover]);

  const applyHighlight = () => {
    const range = pendingRangeRef.current;
    if (!range) return;

    const mark = wrapRangeWithHighlight(range);
    pendingRangeRef.current = null;
    window.getSelection()?.removeAllRanges();

    if (mark) persistContent();
    setPopover(null);
  };

  const removeHighlight = () => {
    if (!popover || popover.type !== "remove") return;
    unwrapHighlight(popover.mark);
    persistContent();
    pendingRangeRef.current = null;
    setPopover(null);
  };

  const Wrapper = inline ? "span" : "div";

  return (
    <>
      <Wrapper
        ref={containerRef}
        data-exam-highlight-surface={inline ? "" : undefined}
        className={cn(inline ? "inline" : undefined, className)}
      >
        {children}
      </Wrapper>

      {popover && typeof document !== "undefined"
        ? createPortal(
            <div
              data-exam-highlight-popover
              className={cn(
                "exam-highlight-popover",
                popover.type === "remove" && "exam-highlight-popover--remove"
              )}
              style={{ left: popover.x, top: popover.y }}
            >
              {popover.type === "selection" ? (
                <button type="button" onClick={applyHighlight}>
                  Highlight
                </button>
              ) : (
                <button type="button" onClick={removeHighlight}>
                  Remove highlight
                </button>
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
