"use client";

import { useMemo } from "react";
import { useCellValues } from "@mdxeditor/gurx";
import {
  $getSelectionStyleValueForProperty,
  $patchStyleText
} from "@lexical/selection";
import { $getSelection, $isRangeSelection } from "lexical";
import { activeEditor$, currentSelection$, Select } from "@mdxeditor/editor";
import { EDITOR_FONT_SIZE_OPTIONS, EDITOR_TEXT_COLOR_OPTIONS } from "./editor-font-options";

function ReadingFontSizeSelect() {
  const [activeEditor, selection] = useCellValues(activeEditor$, currentSelection$);

  const currentSize = useMemo(() => {
    if (!activeEditor) return "16px";
    return activeEditor.getEditorState().read(() => {
      const current = $getSelection();
      if (!$isRangeSelection(current)) return "16px";
      return $getSelectionStyleValueForProperty(current, "font-size", "16px") || "16px";
    });
  }, [activeEditor, selection]);

  return (
    <Select
      value={currentSize}
      onChange={(value) => {
        activeEditor?.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          $patchStyleText(selection, { "font-size": value || null });
        });
      }}
      triggerTitle="Font size"
      placeholder="Size"
      items={EDITOR_FONT_SIZE_OPTIONS.map((option) => ({
        label: option.label,
        value: option.value
      }))}
    />
  );
}

function ReadingTextColorSelect() {
  const [activeEditor, selection] = useCellValues(activeEditor$, currentSelection$);

  const currentColor = useMemo(() => {
    if (!activeEditor) return "default";
    return activeEditor.getEditorState().read(() => {
      const current = $getSelection();
      if (!$isRangeSelection(current)) return "default";
      return $getSelectionStyleValueForProperty(current, "color", "") || "default";
    });
  }, [activeEditor, selection]);

  return (
    <Select
      value={currentColor}
      onChange={(value) => {
        activeEditor?.update(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          $patchStyleText(selection, { color: value === "default" ? null : value || null });
        });
      }}
      triggerTitle="Text color"
      placeholder="Color"
      items={EDITOR_TEXT_COLOR_OPTIONS.map((option) => ({
        label: option.label,
        value: option.value
      }))}
    />
  );
}

export { ReadingFontSizeSelect, ReadingTextColorSelect };
