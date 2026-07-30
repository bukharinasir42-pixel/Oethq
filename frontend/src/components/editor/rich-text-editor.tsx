"use client";

import { useEffect } from "react";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
  Link as LinkIcon,
  Rows3,
  Columns3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { EDITOR_FONT_SIZE_OPTIONS, EDITOR_TEXT_COLOR_OPTIONS } from "./editor-font-options";
import { FontSize } from "./tiptap-font-size";

type RichTextEditorProps = {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  /** Minimum height of the editable area */
  minHeight?: "sm" | "md" | "lg" | "xl";
};

const minHClass = {
  sm: "min-h-[120px]",
  md: "min-h-[180px]",
  lg: "min-h-[260px]",
  xl: "min-h-[70vh]"
};

export function RichTextEditor({
  id,
  value,
  onChange,
  placeholder = "Write something…",
  className,
  minHeight = "md"
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        bulletList: { HTMLAttributes: { class: "list-disc pl-4" } },
        orderedList: { HTMLAttributes: { class: "list-decimal pl-4" } }
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: { class: "rich-text-table" }
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder }),
      TextStyle,
      FontSize,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline underline-offset-2" }
      })
    ],
    content: value || "",
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: cn(
          "max-w-none px-3 py-2 text-base leading-relaxed text-foreground focus:outline-none",
          minHClass[minHeight]
        )
      }
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    }
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border border-border bg-muted/30",
          minHClass[minHeight],
          className
        )}
        aria-hidden
      />
    );
  }

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const next = window.prompt("Link URL", previous || "https://");
    if (next === null) return;
    if (next === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: next }).run();
  };

  const currentFontSize = editor.getAttributes("textStyle").fontSize as string | undefined;
  const currentColor = editor.getAttributes("textStyle").color as string | undefined;

  return (
    <div
      id={id}
      className={cn(
        "overflow-hidden rounded-md border border-input bg-background shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 px-1 py-1">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Highlight"
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
        <Select
          value={currentFontSize || "16px"}
          onValueChange={(size) => editor.chain().focus().setFontSize(size).run()}
        >
          <SelectTrigger className="h-8 w-[118px] text-xs" aria-label="Font size">
            <Type className="mr-1 h-3.5 w-3.5 shrink-0" />
            <SelectValue placeholder="Size" />
          </SelectTrigger>
          <SelectContent>
            {EDITOR_FONT_SIZE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={currentColor || "default"}
          onValueChange={(color) => {
            if (color === "default") {
              editor.chain().focus().unsetColor().run();
              return;
            }
            editor.chain().focus().setColor(color).run();
          }}
        >
          <SelectTrigger className="h-8 w-[108px] text-xs" aria-label="Text color">
            <SelectValue placeholder="Color" />
          </SelectTrigger>
          <SelectContent>
            {EDITOR_TEXT_COLOR_OPTIONS.map((option) => (
              <SelectItem key={option.label} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={
            editor.isActive("heading", { level: 2 })
              ? "h2"
              : editor.isActive("heading", { level: 3 })
                ? "h3"
                : "paragraph"
          }
          onValueChange={(block) => {
            if (block === "h2") {
              editor.chain().focus().toggleHeading({ level: 2 }).run();
              return;
            }
            if (block === "h3") {
              editor.chain().focus().toggleHeading({ level: 3 }).run();
              return;
            }
            editor.chain().focus().setParagraph().run();
          }}
        >
          <SelectTrigger className="h-8 w-[124px] text-xs" aria-label="Block type">
            <SelectValue placeholder="Block" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">Paragraph</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
          </SelectContent>
        </Select>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
        <ToolbarButton
          label="Insert table"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        {editor.isActive("table") ? (
          <>
            <ToolbarButton
              label="Add row"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <Rows3 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Add column"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <Columns3 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
              label="Delete table"
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              <Trash2 className="h-4 w-4" />
            </ToolbarButton>
          </>
        ) : null}
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={setLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} className={cn("tiptap-editor", minHClass[minHeight])} />
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  active,
  onClick
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", active && "bg-muted text-foreground")}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
