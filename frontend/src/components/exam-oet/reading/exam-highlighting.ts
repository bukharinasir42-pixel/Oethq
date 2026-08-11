"use client";

/**
 * Reading exam: highlight anything, copy nothing.
 *
 * A candidate marking up a passage is doing what they would do on paper, and it
 * is a real exam technique — so highlighting covers the texts, the questions and
 * the answer options alike, not just the passage.
 *
 * Copying is a different matter: the papers are the product. The two pull
 * against each other, because a highlight IS a text selection and copying is
 * what a selection is for. So selection stays on and the *exits* are closed —
 * copy, cut, drag-out, the right-click menu, and the keyboard shortcuts.
 *
 * What this does NOT do, and cannot: stop devtools, view-source, a screenshot or
 * a phone camera. Nothing running in the page can. This closes the casual
 * routes — select, Ctrl+C, paste — which is the traffic that actually happens.
 *
 * A student's own typing is theirs: inputs and textareas are exempt from every
 * rule below, so they can still select and correct their own answers.
 */
import { useEffect, useLayoutEffect, useRef } from "react";

const MARK = "oet-hl";
const MARK_SELECTOR = `mark.${MARK}`;
/** Marks the elements whose text may be highlighted. */
export const HL_REGION_ATTR = "data-hl-region";

type Span = [start: number, end: number];

const isEditable = (n: Node | null): boolean => {
  const el = n instanceof Element ? n : n?.parentElement ?? null;
  return Boolean(el?.closest("input, textarea, select, [contenteditable='true']"));
};

/** Text nodes we are willing to mark: not inside a control, not opted out. */
function highlightableTextNodes(root: HTMLElement): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest("input, textarea, select, [data-hl-skip]")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
}

/* ------------------------------------------------------------- serialising */

/**
 * Highlights are stored as character offsets into the region's plain text.
 * Offsets survive a reload because a <mark> does not change the text — only how
 * it is wrapped — so the same content always produces the same numbering.
 */
export function serialiseRegion(region: HTMLElement): Span[] {
  const spans: Span[] = [];
  let pos = 0;
  for (const node of highlightableTextNodes(region)) {
    const len = node.nodeValue?.length ?? 0;
    if (node.parentElement?.closest(MARK_SELECTOR)) {
      const last = spans[spans.length - 1];
      if (last && last[1] === pos) last[1] = pos + len; // merge what is contiguous
      else spans.push([pos, pos + len]);
    }
    pos += len;
  }
  return spans;
}

/** Wrap one text node's [from, to) slice in a mark. Returns the node that follows. */
function wrapSlice(node: Text, from: number, to: number): void {
  const len = node.nodeValue?.length ?? 0;
  const start = Math.max(0, from);
  const end = Math.min(len, to);
  if (end <= start) return;
  const target = start > 0 ? node.splitText(start) : node;
  if (end - start < (target.nodeValue?.length ?? 0)) target.splitText(end - start);
  const mark = document.createElement("mark");
  mark.className = MARK;
  target.parentNode?.insertBefore(mark, target);
  mark.appendChild(target);
}

export function applySpans(region: HTMLElement, spans: Span[]): void {
  // Apply back-to-front: wrapping splits text nodes, which would shift the
  // offsets of everything after the point of insertion.
  const ordered = [...spans].sort((a, b) => b[0] - a[0]);
  for (const [s, e] of ordered) {
    let pos = 0;
    for (const node of highlightableTextNodes(region)) {
      const len = node.nodeValue?.length ?? 0;
      const nodeStart = pos;
      const nodeEnd = pos + len;
      pos = nodeEnd;
      if (nodeEnd <= s || nodeStart >= e) continue;
      if (node.parentElement?.closest(MARK_SELECTOR)) continue; // already marked
      wrapSlice(node, s - nodeStart, e - nodeStart);
    }
  }
}

export function unwrapMark(m: Element): void {
  const parent = m.parentNode;
  if (!parent) return;
  while (m.firstChild) parent.insertBefore(m.firstChild, m);
  parent.removeChild(m);
  if (parent instanceof Element) parent.normalize();
}

export function clearRegion(region: HTMLElement): void {
  region.querySelectorAll(MARK_SELECTOR).forEach(unwrapMark);
}

/* ---------------------------------------------------------------- storage */

const storeKey = (key: string) => `oet_hl_${key}`;

type Store = Record<string, Span[]>;

function readStore(key: string): Store {
  try {
    const raw = localStorage.getItem(storeKey(key));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(key: string, store: Store): void {
  try {
    localStorage.setItem(storeKey(key), JSON.stringify(store));
  } catch {
    // A full or blocked localStorage must never break the exam. Highlights are
    // an aid; losing them is survivable, losing the test is not.
  }
}

/** Called when the attempt is submitted — the marking has served its purpose. */
export function clearStoredHighlights(key: string): void {
  try {
    localStorage.removeItem(storeKey(key));
  } catch {
    /* nothing to do */
  }
}

/* ------------------------------------------------------------------- hooks */

/**
 * Highlighting for every region inside `root` carrying `data-hl-region`.
 *
 * Regions are re-scanned on each render because Part B, Part C and the Part A
 * text tabs mount and unmount as the student moves around; a region that
 * reappears is restored from what was saved rather than coming back blank.
 */
export function useHighlighting(
  root: React.RefObject<HTMLElement>,
  storeId: string | null,
  deps: unknown[] = []
): void {
  const reconcileRef = useRef<(() => void) | null>(null);

  // After every render, not just on mount. React re-renders this exam on each
  // timer tick and rebuilds the question panes, discarding the <mark> nodes
  // injected by hand; only the passage escapes that because it is memoized.
  // Running as a layout effect means the marks are back before the browser
  // paints, so nothing flickers.
  useLayoutEffect(() => { reconcileRef.current?.(); });

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const regionOf = (n: Node | null): HTMLElement | null => {
      const start = n instanceof Element ? n : n?.parentElement ?? null;
      return start?.closest<HTMLElement>(`[${HL_REGION_ATTR}]`) ?? null;
    };
    const keyOf = (region: HTMLElement) => region.getAttribute(HL_REGION_ATTR) ?? "";

    /**
     * Bring every region's marks back in line with what was stored.
     *
     * A region is only touched when it has actually drifted — normally nothing
     * has, so this costs one walk and no DOM writes. Skipped outright while the
     * student has text selected, because splitting nodes underneath a live
     * selection would destroy the drag they are in the middle of making.
     */
    const reconcile = () => {
      if (!storeId) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
      const store = readStore(storeId);
      el.querySelectorAll<HTMLElement>(`[${HL_REGION_ATTR}]`).forEach((region) => {
        const want = store[keyOf(region)] ?? [];
        const have = serialiseRegion(region);
        if (JSON.stringify(want) === JSON.stringify(have)) return;
        clearRegion(region);
        if (want.length) applySpans(region, want);
      });
    };

    const save = (region: HTMLElement) => {
      if (!storeId) return;
      const store = readStore(storeId);
      const spans = serialiseRegion(region);
      if (spans.length) store[keyOf(region)] = spans;
      else delete store[keyOf(region)];
      writeStore(storeId, store);
    };

    // Marks are hand-injected DOM, and React owns this subtree — every timer
    // tick re-renders the exam and wipes them. Reconciliation therefore happens
    // after EVERY render (below), not just when a pane mounts.
    reconcileRef.current = reconcile;
    reconcile();

    // A drag that ends inside an option would otherwise also register as a click
    // and change the student's answer. Only the click belonging to that gesture
    // is swallowed.
    //
    // A plain flag is not enough: a drag does not always produce a click at all,
    // and the flag would then sit armed and eat the student's next real answer
    // instead. So it is a timestamp, checked against a window, and cleared the
    // moment a new gesture starts.
    let markedAt = 0;
    const SWALLOW_MS = 400;
    const onMouseDown = () => { markedAt = 0; };

    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (isEditable(range.commonAncestorContainer)) return; // their own answer box

      const region = regionOf(range.commonAncestorContainer);
      if (!region || !el.contains(region)) return;

      // Collect first: wrapping splits nodes and would invalidate the walk.
      const touched = highlightableTextNodes(region).filter((n) => range.intersectsNode(n));
      if (!touched.length) {
        sel.removeAllRanges();
        return;
      }

      // Dragging back over something already marked takes the mark off again.
      // That is the only way to clear a highlight sitting inside an answer
      // option, where a click has to keep meaning "this is my answer".
      const marks = touched
        .map((n) => n.parentElement?.closest(MARK_SELECTOR))
        .filter((m): m is Element => Boolean(m));
      if (marks.length && marks.length >= touched.length) {
        for (const m of new Set(marks)) unwrapMark(m);
        sel.removeAllRanges();
        markedAt = Date.now();
        save(region);
        return;
      }

      for (const node of [...touched].reverse()) {
        if (node.parentElement?.closest(MARK_SELECTOR)) continue;
        const len = node.nodeValue?.length ?? 0;
        const from = node === range.startContainer ? range.startOffset : 0;
        const to = node === range.endContainer ? range.endOffset : len;
        wrapSlice(node, from, to);
      }
      sel.removeAllRanges();
      markedAt = Date.now();
      save(region);
    };

    // Capture phase, so the option's own onClick never sees this one.
    const onClickCapture = (e: MouseEvent) => {
      if (markedAt && Date.now() - markedAt < SWALLOW_MS) {
        markedAt = 0;
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      const target = e.target as Element | null;
      const mark = target?.closest?.(MARK_SELECTOR);
      // Click-to-remove only applies where a click means nothing else. Inside an
      // answer option a click means "this is my answer", and it has to keep
      // meaning that — a student who highlighted part of an option should not
      // have to click it twice. Those marks are cleared with the Clear button.
      if (mark && el.contains(mark) && !mark.closest("[data-hl-answer]")) {
        const region = regionOf(mark);
        e.stopPropagation();
        e.preventDefault();
        unwrapMark(mark);
        if (region) save(region);
      }
    };

    el.addEventListener("mousedown", onMouseDown, true);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("click", onClickCapture, true);
    return () => {
      reconcileRef.current = null;
      el.removeEventListener("mousedown", onMouseDown, true);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("click", onClickCapture, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, storeId, ...deps]);
}

/**
 * Close the routes text can leave by. Everything here is deliberately scoped to
 * the exam element, so the rest of the portal is untouched.
 */
export function useCopyProtection(root: React.RefObject<HTMLElement>): void {
  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const fromOwnAnswer = (t: EventTarget | null) => isEditable(t as Node | null);

    /** Is anything currently selected inside the exam? */
    const selectionInExam = (): boolean => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return false;
      const r = sel.getRangeAt(0);
      return el.contains(r.commonAncestorContainer) || r.intersectsNode(el);
    };

    // Listeners go on the document, not the exam element. Keyboard events only
    // reach an element when focus is inside it, and a student who has clicked
    // nothing has focus on <body> — so an element-scoped handler would miss the
    // very shortcut it exists to block. Containment is checked instead.
    const block = (e: Event) => {
      if (fromOwnAnswer(e.target)) return; // their own typing stays theirs
      const target = e.target as Node | null;
      const inExam = (target && el.contains(target)) || selectionInExam();
      if (!inExam) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      // Printing renders the whole passage, so it goes even from an answer box.
      if (k === "p") { e.preventDefault(); return; }
      if (fromOwnAnswer(e.target) || fromOwnAnswer(document.activeElement)) return;
      if (k === "c" || k === "x") {
        if (selectionInExam()) e.preventDefault();
        return;
      }
      // Ctrl+A with nothing focused selects the entire document, passage included.
      if (k === "a") e.preventDefault();
    };

    document.addEventListener("copy", block, true);
    document.addEventListener("cut", block, true);
    document.addEventListener("contextmenu", block, true);
    document.addEventListener("dragstart", block, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("copy", block, true);
      document.removeEventListener("cut", block, true);
      document.removeEventListener("contextmenu", block, true);
      document.removeEventListener("dragstart", block, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [root]);
}
