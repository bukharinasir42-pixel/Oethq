"use client";

import { useEffect, useState } from "react";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { toEditableHtml } from "@/lib/rich-content";

type ReadingBookletContentEditorProps = {
  id?: string;
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: "sm" | "md" | "lg" | "xl";
  contentSeed?: number;
};

/**
 * Always use TipTap for reading booklets.
 * Legacy content is hybrid HTML+markdown that MDXEditor cannot load (shows empty),
 * while Preview renders the same content via react-markdown + rehype-raw.
 */
export function ReadingBookletContentEditor({
  id,
  value,
  onChange,
  placeholder,
  minHeight = "lg",
  contentSeed = 0
}: ReadingBookletContentEditorProps) {
  const [html, setHtml] = useState(() => toEditableHtml(value));

  // Re-convert only when the parent hydrates saved content (seed bump).
  // Do not depend on `value` — TipTap onChange would re-trigger conversion every keystroke.
  useEffect(() => {
    setHtml(toEditableHtml(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: seed marks hydrate boundaries
  }, [contentSeed]);

  return (
    <RichTextEditor
      key={`${id || "booklet"}-${contentSeed}`}
      id={id}
      minHeight={minHeight}
      value={html}
      onChange={(next) => {
        setHtml(next);
        onChange(next);
      }}
      placeholder={placeholder}
    />
  );
}
