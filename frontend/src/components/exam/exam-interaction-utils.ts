export const EXAM_HIGHLIGHT_CLASS = "exam-text-highlight";

export function isExamFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, button, [contenteditable='true']"));
}

export function getHighlightContentRoot(container: HTMLElement): HTMLElement | null {
  const nested = container.querySelector<HTMLElement>(".mdx-content, .tiptap-editor .ProseMirror");
  if (nested) return nested;
  if (container.dataset.examHighlightSurface !== undefined) return container;
  return null;
}

export function rangeIntersectsFormControl(range: Range, container: HTMLElement): boolean {
  const controls = container.querySelectorAll("input, textarea, select, button");
  for (let i = 0; i < controls.length; i++) {
    const control = controls[i];
    if (typeof range.intersectsNode === "function" && range.intersectsNode(control)) {
      return true;
    }
  }
  return false;
}

export function wrapRangeWithHighlight(range: Range): HTMLElement | null {
  const mark = document.createElement("mark");
  mark.className = EXAM_HIGHLIGHT_CLASS;

  try {
    range.surroundContents(mark);
    return mark;
  } catch {
    try {
      const extracted = range.extractContents();
      mark.appendChild(extracted);
      range.insertNode(mark);
      return mark;
    } catch {
      return null;
    }
  }
}

export function unwrapHighlight(mark: HTMLElement) {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) {
    parent.insertBefore(mark.firstChild, mark);
  }
  parent.removeChild(mark);
  parent.normalize();
}

export function findHighlightMark(target: EventTarget | null, container: HTMLElement): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  const mark = target.closest(`mark.${EXAM_HIGHLIGHT_CLASS}`);
  if (!mark || !(mark instanceof HTMLElement)) return null;
  return container.contains(mark) ? mark : null;
}
