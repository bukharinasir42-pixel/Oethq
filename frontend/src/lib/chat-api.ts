import { getApiBase, getToken } from "@/lib/api";
import { getVisitorKey } from "@/lib/attribution";

export type ChatConfig = { enabled: boolean; knowledgeReady: boolean };

export type StoredMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  errorCode: string | null;
};

export async function fetchChatConfig(): Promise<ChatConfig> {
  try {
    const res = await fetch(`${getApiBase()}/chat/config`, { cache: "no-store" });
    if (!res.ok) return { enabled: false, knowledgeReady: false };
    return (await res.json()) as ChatConfig;
  } catch {
    return { enabled: false, knowledgeReady: false };
  }
}

export async function fetchTranscript(conversationId: string): Promise<StoredMessage[]> {
  try {
    const res = await fetch(
      `${getApiBase()}/chat/conversations/${conversationId}?visitorKey=${encodeURIComponent(getVisitorKey())}`,
      { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}, cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { messages?: StoredMessage[] };
    return json.messages ?? [];
  } catch {
    return [];
  }
}

export type StreamHandlers = {
  onStart?: (conversationId: string) => void;
  onDelta?: (text: string) => void;
  /** The whole answer, replacing anything streamed so far. */
  onReplace?: (text: string) => void;
  onDone?: (info: { text: string; handoff: boolean; error: string | null }) => void;
  onError?: (message: string) => void;
};

/**
 * Send one message and consume the reply stream.
 *
 * Parsed by hand rather than with `EventSource`, for two reasons that matter
 * here: EventSource cannot issue a POST (so the message would have to go in the
 * URL), and it cannot carry an Authorization header (so a signed-in student
 * would be indistinguishable from a stranger).
 */
export async function sendChatMessage(
  message: string,
  conversationId: string | null,
  handlers: StreamHandlers,
  signal?: AbortSignal,
  /** `data:image/...;base64,...` strings. Sent once, never stored by us. */
  images: string[] = []
): Promise<void> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/chat/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message, conversationId, visitorKey: getVisitorKey(), images }),
      signal,
      cache: "no-store"
    });
  } catch {
    handlers.onError?.("Could not reach the assistant. Check your connection and try again.");
    return;
  }

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    handlers.onError?.(body?.message ?? "The assistant is unavailable right now.");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line. A partial frame stays in the
      // buffer — a chunk boundary can fall anywhere, including mid-JSON.
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const frame = buffer.slice(0, sep).trim();
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");
        if (!frame.startsWith("data:")) continue;
        let event: { type?: string; [k: string]: unknown };
        try {
          event = JSON.parse(frame.slice(5).trim());
        } catch {
          continue;
        }
        if (event.type === "start") handlers.onStart?.(String(event.conversationId));
        else if (event.type === "delta") handlers.onDelta?.(String(event.text ?? ""));
        else if (event.type === "replace") handlers.onReplace?.(String(event.text ?? ""));
        else if (event.type === "done") {
          handlers.onDone?.({
            text: String(event.text ?? ""),
            handoff: Boolean(event.handoff),
            error: (event.error as string | null) ?? null
          });
        } else if (event.type === "error") {
          handlers.onError?.(String(event.message ?? "Something went wrong."));
        }
      }
    }
  } catch (e) {
    // An abort is the student closing the widget, not a failure to report.
    if ((e as Error)?.name !== "AbortError") {
      handlers.onError?.("The connection dropped part-way through the answer.");
    }
  }
}
