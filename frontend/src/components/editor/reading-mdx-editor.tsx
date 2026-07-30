"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import { cn } from "@/lib/utils";
import { toEditorMarkdown } from "@/lib/rich-content";

const InitializedMdxEditor = dynamic(() => import("./initialized-mdx-editor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[260px] rounded-md border border-border bg-muted/30" aria-hidden />
  )
});

type ReadingMdxEditorProps = {
  id?: string;
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: "sm" | "md" | "lg" | "xl";
  /** Bumps when parent hydrates saved content so MDXEditor remounts with the correct initial markdown. */
  contentSeed?: number;
};

const minHClass = {
  sm: "min-h-[120px]",
  md: "min-h-[180px]",
  lg: "min-h-[260px]",
  xl: "min-h-[70vh]"
};

export function ReadingMdxEditor({
  id,
  value,
  onChange,
  placeholder,
  className,
  minHeight = "md",
  contentSeed = 0
}: ReadingMdxEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const onChangeRef = useRef(onChange);
  const loadedMarkdownRef = useRef(toEditorMarkdown(value));
  const userEditedRef = useRef(false);
  const syncingRef = useRef(false);
  const mountMarkdown = toEditorMarkdown(value);
  const [canMountEditor, setCanMountEditor] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    loadedMarkdownRef.current = toEditorMarkdown(value);
    userEditedRef.current = false;
    // contentSeed bumps when the parent hydrates saved booklet content from the API.
  }, [contentSeed]);

  useEffect(() => {
    setCanMountEditor(false);
    const frame = requestAnimationFrame(() => setCanMountEditor(true));
    return () => cancelAnimationFrame(frame);
  }, [contentSeed, mountMarkdown.length]);

  useEffect(() => {
    const nextMarkdown = mountMarkdown;
    let cancelled = false;
    let frame = 0;

    const apply = () => {
      if (cancelled) return true;
      const editor = editorRef.current;
      if (!editor) return false;
      if (userEditedRef.current) return true;
      if (editor.getMarkdown() !== nextMarkdown) {
        syncingRef.current = true;
        editor.setMarkdown(nextMarkdown);
        syncingRef.current = false;
        loadedMarkdownRef.current = nextMarkdown;
      }
      return true;
    };

    if (apply()) return;

    const retry = () => {
      if (apply()) return;
      frame = requestAnimationFrame(retry);
    };
    frame = requestAnimationFrame(retry);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [mountMarkdown, contentSeed]);

  useEffect(() => {
    return () => {
      const editor = editorRef.current;
      if (!editor) return;
      const markdown = editor.getMarkdown();
      if (!markdown.trim()) return;
      if (markdown === loadedMarkdownRef.current) return;
      loadedMarkdownRef.current = markdown;
      onChangeRef.current(markdown);
    };
  }, []);

  const handleChange = (markdown: string, initialMarkdownNormalize?: boolean) => {
    if (syncingRef.current) return;
    if (initialMarkdownNormalize) return;
    if (!markdown.trim() && loadedMarkdownRef.current.trim() && !userEditedRef.current) return;

    userEditedRef.current = true;
    loadedMarkdownRef.current = markdown;
    onChangeRef.current(markdown);
  };

  return (
    <div
      id={id}
      className={cn(
        "mdx-editor-shell rounded-md border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
    >
      {canMountEditor ? (
        <InitializedMdxEditor
          key={`${contentSeed}-${mountMarkdown.length}-${mountMarkdown.slice(0, 48)}`}
          editorRef={editorRef}
          markdown={mountMarkdown}
          onChange={handleChange}
          placeholder={placeholder}
          contentEditableClassName={cn(
            "mdx-editor-content max-w-none px-3 py-2 text-base leading-relaxed text-foreground focus:outline-none",
            minHClass[minHeight]
          )}
          className="mdx-editor-root"
        />
      ) : (
        <div
          className={cn(
            "rounded-md border border-border bg-muted/30",
            minHClass[minHeight]
          )}
          aria-hidden
        />
      )}
    </div>
  );
}
