"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchChatConfig, fetchTranscript, sendChatMessage } from "@/lib/chat-api";

/**
 * The site assistant.
 *
 * Mounted once at the root so it follows the visitor from the marketing pages
 * into the portal without being re-added to each layout.
 *
 * Styling is inline rather than utility classes on purpose. The portal shell
 * carries a global reset (`.oethq-portal button { border:none; background:none;
 * color:inherit }`) whose specificity beats Tailwind's, so a widget that renders
 * correctly on the public site would come out as unstyled text the moment a
 * student opened it inside the portal.
 */

const CONVERSATION_KEY = "oet_chat_conversation";
const OPENED_KEY = "oet_chat_seen";

/**
 * Routes the assistant must never appear on.
 *
 * The exam routes are the important ones and they are not a nicety: a chat box
 * on top of a Reading paper is a way to ask for the answers, which is precisely
 * what the highlighting/copy work was there to prevent. Admin is excluded
 * because it is a staff tool, not a place to spend model tokens.
 */
const HIDDEN_PREFIXES = ["/admin", "/portal/tests", "/portal/past-papers/", "/test/"];

function isHidden(pathname: string | null): boolean {
  if (!pathname) return true;
  return HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

type Bubble = { id: string; role: "user" | "assistant"; text: string; pending?: boolean; failed?: boolean };

const BRAND = "#0F3D6E";
const BRAND_SOFT = "#EAF1F9";

function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 520px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
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

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  // Restore the thread so reopening the widget — or coming back tomorrow — is
  // not a blank box that loses everything already explained.
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

  const scrollToEnd = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, scrollToEnd]);

  useEffect(() => {
    if (open) {
      try {
        localStorage.setItem(OPENED_KEY, "1");
      } catch {
        /* storage denied */
      }
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Escape closes, and closing aborts an answer in flight so a student who
  // walks away is not billed for a reply nobody will read.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
  }, [open]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;

    const userBubble: Bubble = { id: `u-${Date.now()}`, role: "user", text };
    const replyId = `a-${Date.now()}`;
    setMessages((m) => [...m, userBubble, { id: replyId, role: "assistant", text: "", pending: true }]);
    setDraft("");
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
          // half a sentence sitting on screen as if it were the whole answer.
          patch((b) => ({ ...b, text: info.text || b.text, pending: false, failed: Boolean(info.error) }));
          setHandoff(info.handoff);
        },
        onError: (msg) => patch((b) => ({ ...b, text: msg, pending: false, failed: true }))
      },
      controller.signal
    );

    setBusy(false);
    abortRef.current = null;
  }, [draft, busy, conversationId]);

  const startOver = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setHandoff(false);
    try {
      localStorage.removeItem(CONVERSATION_KEY);
    } catch {
      /* storage denied */
    }
    setTimeout(() => inputRef.current?.focus(), 40);
  }, []);

  const suggestions = useMemo(
    () => ["What is included in the course?", "How much does it cost?", "How do the live classes work?"],
    []
  );

  if (hidden || !enabled) return null;

  const panelStyle: React.CSSProperties = narrow
    ? { position: "fixed", inset: 0, zIndex: 2147483000, display: "flex", flexDirection: "column", background: "#fff" }
    : {
        position: "fixed",
        right: 20,
        bottom: 92,
        zIndex: 2147483000,
        width: 380,
        maxWidth: "calc(100vw - 40px)",
        height: 560,
        maxHeight: "calc(100vh - 130px)",
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #DCE5F0",
        boxShadow: "0 20px 50px rgba(15, 61, 110, 0.18)",
        overflow: "hidden"
      };

  return (
    <>
      {open ? (
        <div style={panelStyle} role="dialog" aria-label="OET HQ assistant" aria-modal={narrow}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              background: BRAND,
              color: "#fff",
              flexShrink: 0
            }}
          >
            <span
              aria-hidden
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                background: "rgba(255,255,255,0.18)",
                display: "grid",
                placeItems: "center",
                font: "700 13px/1 system-ui, sans-serif"
              }}
            >
              HQ
            </span>
            <span style={{ font: "700 14px/1.3 system-ui, sans-serif", flex: 1 }}>
              OET HQ assistant
              <span style={{ display: "block", font: "400 11px/1.4 system-ui, sans-serif", opacity: 0.8 }}>
                Answers about the course and the exam
              </span>
            </span>
            {messages.length > 0 ? (
              <button
                type="button"
                onClick={startOver}
                style={{
                  background: "rgba(255,255,255,0.16)",
                  color: "#fff",
                  border: 0,
                  borderRadius: 8,
                  padding: "6px 9px",
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
                width: 30,
                height: 30,
                font: "700 18px/1 system-ui, sans-serif",
                cursor: "pointer"
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
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              background: "#F7FAFD"
            }}
          >
            {messages.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ font: "400 13px/1.55 system-ui, sans-serif", color: "#42526B", margin: 0 }}>
                  Ask anything about OET HQ — what is included, how the classes run, or how to use the
                  course. If I do not know, I will say so and pass you to a person.
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
                      border: "1px solid #DCE5F0",
                      borderRadius: 10,
                      padding: "9px 11px",
                      font: "500 12.5px/1.4 system-ui, sans-serif",
                      cursor: "pointer"
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
                  maxWidth: "86%",
                  background: m.role === "user" ? BRAND : m.failed ? "#FDECEA" : "#fff",
                  color: m.role === "user" ? "#fff" : m.failed ? "#8A2A22" : "#16233A",
                  border: m.role === "user" ? "none" : `1px solid ${m.failed ? "#F5C6C1" : "#E2EAF4"}`,
                  borderRadius: 12,
                  padding: "9px 12px",
                  font: "400 13.5px/1.55 system-ui, sans-serif",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word"
                }}
              >
                {m.pending ? <TypingDots /> : m.text}
              </div>
            ))}

            {handoff ? (
              <div
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "86%",
                  background: BRAND_SOFT,
                  border: "1px solid #C9DCF0",
                  borderRadius: 12,
                  padding: "9px 12px",
                  font: "500 12.5px/1.5 system-ui, sans-serif",
                  color: BRAND
                }}
              >
                A person from the team can pick this up — use the contact page and mention what you
                asked here.
              </div>
            ) : null}
          </div>

          <div style={{ borderTop: "1px solid #E2EAF4", padding: 10, background: "#fff", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter is a new line. On a phone the key
                  // is "return" and inserting a newline is what people expect,
                  // so it only sends on a real keyboard.
                  if (e.key === "Enter" && !e.shiftKey && !narrow) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Ask a question…"
                aria-label="Your message"
                style={{
                  flex: 1,
                  resize: "none",
                  minHeight: 40,
                  maxHeight: 120,
                  borderRadius: 10,
                  border: "1px solid #D6E1EE",
                  padding: "10px 11px",
                  font: "400 13.5px/1.45 system-ui, sans-serif",
                  color: "#16233A",
                  background: "#fff",
                  outline: "none"
                }}
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || !draft.trim()}
                aria-label="Send"
                style={{
                  height: 40,
                  minWidth: 60,
                  borderRadius: 10,
                  border: 0,
                  background: busy || !draft.trim() ? "#B9C7D8" : BRAND,
                  color: "#fff",
                  font: "700 13px/1 system-ui, sans-serif",
                  cursor: busy || !draft.trim() ? "default" : "pointer"
                }}
              >
                {busy ? "…" : "Send"}
              </button>
            </div>
            <p style={{ margin: "7px 2px 0", font: "400 10.5px/1.4 system-ui, sans-serif", color: "#7A8AA0" }}>
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
          right: 20,
          bottom: 20,
          zIndex: 2147483001,
          height: 54,
          minWidth: 54,
          padding: open ? 0 : "0 18px 0 16px",
          borderRadius: 999,
          border: 0,
          background: BRAND,
          color: "#fff",
          display: open && narrow ? "none" : "inline-flex",
          alignItems: "center",
          gap: 9,
          font: "700 13.5px/1 system-ui, sans-serif",
          boxShadow: "0 10px 28px rgba(15, 61, 110, 0.32)",
          cursor: "pointer"
        }}
      >
        <span aria-hidden style={{ font: "700 17px/1 system-ui, sans-serif" }}>
          {open ? "×" : "💬"}
        </span>
        {open ? null : <span>Ask us</span>}
      </button>
    </>
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
