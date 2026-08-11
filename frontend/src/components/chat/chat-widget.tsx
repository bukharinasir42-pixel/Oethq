"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchChatConfig, fetchTranscript, sendChatMessage } from "@/lib/chat-api";
import {
  dictationSupported,
  prepareImage,
  startDictation,
  type Dictation,
  type PreparedImage
} from "@/lib/chat-attachments";

/**
 * The OET HQ assistant.
 *
 * Mounted once at the root so it follows the visitor from the marketing pages
 * into the portal without being re-added to each layout.
 *
 * Styling is inline rather than utility classes on purpose. The portal shell
 * carries a global reset (`.oethq-portal button { border:none; background:none;
 * color:inherit }`) whose specificity beats Tailwind's, so a widget that looked
 * right on the public site would render as unstyled text the moment a student
 * opened it inside the portal.
 */

const CONVERSATION_KEY = "oet_chat_conversation";

/**
 * Routes the assistant must never appear on.
 *
 * The exam routes are the important ones and they are not a nicety: a chat box
 * on top of a Reading paper is a way to ask for the answers, which is precisely
 * what the highlighting and copy-blocking work exists to prevent. Admin is
 * excluded because it is a staff tool, not a place to spend model tokens.
 */
const HIDDEN_PREFIXES = ["/admin", "/portal/tests", "/portal/past-papers/", "/test/"];

const isHidden = (pathname: string | null) =>
  !pathname || HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));

type Bubble = {
  id: string;
  role: "user" | "assistant";
  text: string;
  images?: string[];
  pending?: boolean;
  failed?: boolean;
};

const INK = "#0B2E4F";
const BRAND = "#12508A";
const ACCENT = "#1B7FC4";
const SURFACE = "#F6F9FC";
const LINE = "#DCE6F1";

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 560px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

/** Turn bare URLs into links. The assistant is told to send plain text only. */
function renderText(text: string) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit", textDecoration: "underline", wordBreak: "break-all" }}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function ChatWidget() {
  const pathname = usePathname();
  const hidden = isHidden(pathname);
  const narrow = useIsNarrow();

  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [pendingImages, setPendingImages] = useState<PreparedImage[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canDictate, setCanDictate] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dictationRef = useRef<Dictation | null>(null);
  /** Text typed before dictation began, so interim results replace cleanly. */
  const dictationBaseRef = useRef("");

  useEffect(() => setCanDictate(dictationSupported()), []);

  // Ask the server whether the assistant is switched on at all. Without a key
  // configured the launcher must not appear — a chat button that opens onto an
  // error is worse than no chat button.
  useEffect(() => {
    if (hidden) return;
    let live = true;
    void fetchChatConfig().then((c) => {
      if (live) setEnabled(c.enabled);
    });
    return () => {
      live = false;
    };
  }, [hidden]);

  // Restore the thread so reopening the widget is not a blank box that loses
  // everything already explained.
  useEffect(() => {
    if (!open || messages.length > 0) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(CONVERSATION_KEY);
    } catch {
      /* storage denied */
    }
    if (!stored) return;
    setConversationId(stored);
    void fetchTranscript(stored).then((rows) => {
      if (rows.length === 0) return;
      setMessages(
        rows.map((m) => ({
          id: m.id,
          role: m.role === "USER" ? "user" : "assistant",
          text: m.content,
          failed: Boolean(m.errorCode)
        }))
      );
    });
  }, [open, messages.length]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingImages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Closing aborts an answer in flight and stops the microphone: a student who
  // walks away should not be billed for a reply nobody reads, and a mic left
  // live after the panel closes is indefensible.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      dictationRef.current?.stop();
      setListening(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      dictationRef.current?.stop();
    };
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    setAttachError(null);
    const room = 3 - pendingImages.length;
    if (room <= 0) {
      setAttachError("Three images at a time is the limit.");
      return;
    }
    const chosen = Array.from(files).slice(0, room);
    for (const file of chosen) {
      try {
        const prepared = await prepareImage(file);
        setPendingImages((cur) => (cur.length >= 3 ? cur : [...cur, prepared]));
      } catch (e) {
        setAttachError(e instanceof Error ? e.message : "That image could not be attached.");
      }
    }
  }, [pendingImages.length]);

  const toggleDictation = useCallback(() => {
    if (listening) {
      dictationRef.current?.stop();
      return;
    }
    setAttachError(null);
    dictationBaseRef.current = draft ? `${draft.trimEnd()} ` : "";
    const handle = startDictation({
      onText: (text, isFinal) => {
        setDraft(dictationBaseRef.current + text);
        if (isFinal) dictationBaseRef.current = `${(dictationBaseRef.current + text).trimEnd()} `;
      },
      onEnd: () => {
        setListening(false);
        dictationRef.current = null;
        setTimeout(() => inputRef.current?.focus(), 30);
      },
      onError: (m) => setAttachError(m)
    });
    if (handle) {
      dictationRef.current = handle;
      setListening(true);
    }
  }, [listening, draft]);

  const send = useCallback(async () => {
    const text = draft.trim();
    const images = pendingImages;
    if ((!text && images.length === 0) || busy) return;

    dictationRef.current?.stop();

    const userBubble: Bubble = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
      images: images.map((i) => i.previewUrl)
    };
    const replyId = `a-${Date.now()}`;
    setMessages((m) => [...m, userBubble, { id: replyId, role: "assistant", text: "", pending: true }]);
    setDraft("");
    setPendingImages([]);
    setAttachError(null);
    setBusy(true);
    setHandoff(false);

    const controller = new AbortController();
    abortRef.current = controller;

    const patch = (fn: (b: Bubble) => Bubble) =>
      setMessages((m) => m.map((b) => (b.id === replyId ? fn(b) : b)));

    await sendChatMessage(
      text,
      conversationId,
      {
        onStart: (id) => {
          setConversationId(id);
          try {
            localStorage.setItem(CONVERSATION_KEY, id);
          } catch {
            /* storage denied */
          }
        },
        onDelta: (chunk) => patch((b) => ({ ...b, text: b.text + chunk, pending: false })),
        onReplace: (full) => patch((b) => ({ ...b, text: full, pending: false })),
        onDone: (info) => {
          // The done frame is authoritative — a stream cut short must not leave
          // half a sentence on screen, and a rewritten link must replace the
          // one that was streamed.
          patch((b) => ({ ...b, text: info.text || b.text, pending: false, failed: Boolean(info.error) }));
          setHandoff(info.handoff);
        },
        onError: (msg) => patch((b) => ({ ...b, text: msg, pending: false, failed: true }))
      },
      controller.signal,
      images.map((i) => i.dataUrl)
    );

    setBusy(false);
    abortRef.current = null;
  }, [draft, pendingImages, busy, conversationId]);

  const startOver = useCallback(() => {
    abortRef.current?.abort();
    dictationRef.current?.stop();
    setMessages([]);
    setConversationId(null);
    setHandoff(false);
    setPendingImages([]);
    setAttachError(null);
    try {
      localStorage.removeItem(CONVERSATION_KEY);
    } catch {
      /* storage denied */
    }
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  const suggestions = useMemo(
    () => [
      "I failed Reading, what should I do?",
      "What is included in the course?",
      "How do the live classes work?"
    ],
    []
  );

  if (hidden || !enabled) return null;

  const panelStyle: React.CSSProperties = narrow
    ? { position: "fixed", inset: 0, zIndex: 2147483000, display: "flex", flexDirection: "column", background: "#fff" }
    : {
        position: "fixed",
        right: 22,
        bottom: 96,
        zIndex: 2147483000,
        width: 396,
        maxWidth: "calc(100vw - 44px)",
        height: 600,
        maxHeight: "calc(100vh - 140px)",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        borderRadius: 18,
        border: `1px solid ${LINE}`,
        boxShadow: "0 24px 60px rgba(11, 46, 79, 0.22), 0 2px 8px rgba(11, 46, 79, 0.08)",
        overflow: "hidden"
      };

  const iconBtn = (active = false): React.CSSProperties => ({
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: 10,
    border: `1px solid ${active ? ACCENT : LINE}`,
    background: active ? "#E8F3FC" : "#fff",
    color: active ? BRAND : "#5A6E85",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0
  });

  return (
    <>
      {open ? (
        <div style={panelStyle} role="dialog" aria-label="OET HQ assistant" aria-modal={narrow}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "13px 15px",
              background: `linear-gradient(135deg, ${INK} 0%, ${BRAND} 100%)`,
              color: "#fff",
              flexShrink: 0
            }}
          >
            <span
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.22)",
                display: "grid",
                placeItems: "center",
                font: "700 12px/1 system-ui, sans-serif",
                letterSpacing: 0.3
              }}
            >
              HQ
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: "700 14px/1.3 system-ui, sans-serif" }}>OET HQ</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, font: "400 11px/1.4 system-ui, sans-serif", opacity: 0.85 }}>
                <span
                  aria-hidden
                  style={{ width: 6, height: 6, borderRadius: 999, background: "#5BE49B", display: "inline-block" }}
                />
                Usually replies instantly
              </span>
            </span>
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={startOver}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  font: "600 11px/1 system-ui, sans-serif",
                  cursor: "pointer"
                }}
              >
                New chat
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close the assistant"
              style={{
                background: "transparent",
                color: "#fff",
                border: 0,
                borderRadius: 8,
                width: 32,
                height: 32,
                font: "300 22px/1 system-ui, sans-serif",
                cursor: "pointer",
                padding: 0
              }}
            >
              ×
            </button>
          </header>

          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 15,
              display: "flex",
              flexDirection: "column",
              gap: 11,
              background: SURFACE
            }}
          >
            {messages.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <p style={{ font: "400 13.5px/1.6 system-ui, sans-serif", color: "#3E546B", margin: 0 }}>
                  Tell me which sub-test is holding you back, or send a photo of your score report and
                  I will tell you where the marks are going.
                </p>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setDraft(s);
                      setTimeout(() => inputRef.current?.focus(), 20);
                    }}
                    style={{
                      textAlign: "left",
                      background: "#fff",
                      color: BRAND,
                      border: `1px solid ${LINE}`,
                      borderRadius: 11,
                      padding: "10px 12px",
                      font: "500 12.5px/1.45 system-ui, sans-serif",
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(11,46,79,0.04)"
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}

            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6
                }}
              >
                {m.images && m.images.length > 0 ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {m.images.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt="Attached"
                        style={{
                          width: 120,
                          height: 120,
                          objectFit: "cover",
                          borderRadius: 10,
                          border: `1px solid ${LINE}`
                        }}
                      />
                    ))}
                  </div>
                ) : null}
                {m.pending || m.text ? (
                  <div
                    style={{
                      background: m.role === "user" ? BRAND : m.failed ? "#FDECEA" : "#fff",
                      color: m.role === "user" ? "#fff" : m.failed ? "#8A2A22" : "#152A3F",
                      border: m.role === "user" ? "none" : `1px solid ${m.failed ? "#F5C6C1" : "#E4EDF6"}`,
                      borderRadius: 13,
                      padding: "10px 13px",
                      font: "400 13.5px/1.6 system-ui, sans-serif",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      boxShadow: m.role === "user" ? "none" : "0 1px 2px rgba(11,46,79,0.05)"
                    }}
                  >
                    {m.pending ? <TypingDots /> : renderText(m.text)}
                  </div>
                ) : null}
              </div>
            ))}

            {handoff ? (
              <div
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "88%",
                  background: "#E8F3FC",
                  border: `1px solid #C4DDF2`,
                  borderRadius: 13,
                  padding: "10px 13px",
                  font: "500 12.5px/1.55 system-ui, sans-serif",
                  color: BRAND
                }}
              >
                Someone from the team will pick this up. Use the contact page and mention what you asked
                here.
              </div>
            ) : null}
          </div>

          <div style={{ borderTop: `1px solid ${LINE}`, padding: 11, background: "#fff", flexShrink: 0 }}>
            {pendingImages.length > 0 ? (
              <div style={{ display: "flex", gap: 7, marginBottom: 9, flexWrap: "wrap" }}>
                {pendingImages.map((img, i) => (
                  <span key={i} style={{ position: "relative", display: "inline-block" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.previewUrl}
                      alt={img.name}
                      style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 9, border: `1px solid ${LINE}` }}
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${img.name}`}
                      onClick={() => setPendingImages((cur) => cur.filter((_, j) => j !== i))}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        border: "1px solid #fff",
                        background: INK,
                        color: "#fff",
                        font: "700 12px/1 system-ui, sans-serif",
                        cursor: "pointer",
                        padding: 0
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {attachError ? (
              <p role="alert" style={{ margin: "0 0 8px", font: "500 11.5px/1.4 system-ui, sans-serif", color: "#B42318" }}>
                {attachError}
              </p>
            ) : null}

            <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => {
                  if (e.target.files) void addFiles(e.target.files);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Attach a photo of your score report"
                title="Attach a photo"
                style={iconBtn()}
              >
                <PaperclipIcon />
              </button>

              {canDictate ? (
                <button
                  type="button"
                  onClick={toggleDictation}
                  aria-label={listening ? "Stop dictation" : "Speak instead of typing"}
                  aria-pressed={listening}
                  title={listening ? "Stop" : "Speak"}
                  style={iconBtn(listening)}
                >
                  <MicIcon active={listening} />
                </button>
              ) : null}

              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPaste={(e) => {
                  // Pasting a screenshot is how people actually share a score
                  // report on a laptop.
                  const files = Array.from(e.clipboardData?.files ?? []);
                  if (files.length > 0) {
                    e.preventDefault();
                    void addFiles(files);
                  }
                }}
                onKeyDown={(e) => {
                  // Enter sends on a keyboard; on a phone the key is "return"
                  // and inserting a newline is what people expect.
                  if (e.key === "Enter" && !e.shiftKey && !narrow) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder={listening ? "Listening…" : "Ask a question…"}
                aria-label="Your message"
                style={{
                  flex: 1,
                  minWidth: 0,
                  resize: "none",
                  minHeight: 38,
                  maxHeight: 120,
                  borderRadius: 10,
                  border: `1px solid ${listening ? ACCENT : "#D3E0EE"}`,
                  padding: "9px 11px",
                  font: "400 13.5px/1.45 system-ui, sans-serif",
                  color: "#152A3F",
                  background: "#fff",
                  outline: "none"
                }}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || (!draft.trim() && pendingImages.length === 0)}
                aria-label="Send"
                style={{
                  height: 38,
                  minWidth: 38,
                  flexShrink: 0,
                  borderRadius: 10,
                  border: 0,
                  background: busy || (!draft.trim() && pendingImages.length === 0) ? "#B9C7D8" : BRAND,
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: busy || (!draft.trim() && pendingImages.length === 0) ? "default" : "pointer",
                  padding: 0
                }}
              >
                <SendIcon />
              </button>
            </div>
            <p style={{ margin: "8px 2px 0", font: "400 10.5px/1.45 system-ui, sans-serif", color: "#7A8DA3" }}>
              An assistant, not a person. It can be wrong — check anything important with the team.
            </p>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close the assistant" : "Ask the OET HQ assistant"}
        aria-expanded={open}
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          zIndex: 2147483001,
          height: 56,
          minWidth: 56,
          padding: open ? 0 : "0 20px 0 17px",
          borderRadius: 999,
          border: 0,
          background: `linear-gradient(135deg, ${INK} 0%, ${BRAND} 100%)`,
          color: "#fff",
          display: open && narrow ? "none" : "inline-flex",
          alignItems: "center",
          gap: 9,
          font: "600 14px/1 system-ui, sans-serif",
          boxShadow: "0 12px 30px rgba(11, 46, 79, 0.34)",
          cursor: "pointer"
        }}
      >
        {open ? <span style={{ font: "300 24px/1 system-ui, sans-serif" }}>×</span> : <ChatIcon />}
        {open ? null : <span>Ask us</span>}
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ icons --
   Inline SVG rather than an icon package: this widget renders on the public
   marketing pages, and it should not pull a dependency into that bundle.       */

function ChatIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {active ? <circle cx="12" cy="7" r="1.6" fill="currentColor" /> : null}
    </svg>
  );
}

function TypingDots() {
  return (
    <span aria-label="Typing" style={{ display: "inline-flex", gap: 4, alignItems: "center", height: 18 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "#9FB2C8",
            animation: `oethq-chat-dot 1.1s ${i * 0.18}s infinite ease-in-out`
          }}
        />
      ))}
      <style>{`@keyframes oethq-chat-dot{0%,80%,100%{opacity:.3;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
    </span>
  );
}
