"use client";

import { useCellValue, usePublisher } from "@mdxeditor/gurx";
import type { ForwardedRef } from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  ButtonWithTooltip,
  CodeToggle,
  CreateLink,
  editorInTable$,
  HighlightToggle,
  headingsPlugin,
  iconComponentFor$,
  insertMarkdown$,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  type MDXEditorProps,
  quotePlugin,
  Separator,
  StrikeThroughSupSubToggles,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { ReadingFontSizeSelect, ReadingTextColorSelect } from "./mdx-font-controls";

const READING_TABLE_TEMPLATE = `| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |
|  |  |  |
`;

function ReadingInsertTable() {
  const insertMarkdown = usePublisher(insertMarkdown$);
  const iconComponentFor = useCellValue(iconComponentFor$);
  const isDisabled = useCellValue(editorInTable$);

  return (
    <ButtonWithTooltip
      title="Insert table — click the first row below the ⋯ icons to edit column names"
      onClick={() => insertMarkdown(READING_TABLE_TEMPLATE)}
      {...(isDisabled ? { "aria-disabled": true, "data-disabled": true, disabled: true } : {})}
    >
      {iconComponentFor("table")}
    </ButtonWithTooltip>
  );
}

export default function InitializedMdxEditor({
  editorRef,
  ...props
}: { editorRef: ForwardedRef<MDXEditorMethods> | null } & MDXEditorProps) {
  return (
    <MDXEditor
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        tablePlugin(),
        markdownShortcutPlugin(),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <Separator />
              <BoldItalicUnderlineToggles />
              <StrikeThroughSupSubToggles />
              <CodeToggle />
              <HighlightToggle />
              <Separator />
              <ReadingFontSizeSelect />
              <ReadingTextColorSelect />
              <BlockTypeSelect />
              <Separator />
              <ListsToggle />
              <CreateLink />
              <ReadingInsertTable />
            </>
          )
        })
      ]}
      {...props}
      ref={editorRef}
    />
  );
}
