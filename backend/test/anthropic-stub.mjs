/**
 * A stand-in for api.anthropic.com that speaks the real streaming wire format.
 * Lets the whole chat path be tested — prompt assembly, cache breakpoints, SSE
 * fan-out, marker suppression, refusal handling, usage accounting — without a key.
 *
 * Control it by writing scratch/stub-mode: "normal" | "handoff" | "refusal" | "500".
 */
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";

const DIR = new URL(".", import.meta.url).pathname;
const mode = () => {
  try {
    return readFileSync(`${DIR}stub-mode`, "utf8").trim();
  } catch {
    return "normal";
  }
};

const REPLIES = {
  normal: "You choose four class days a week yourself, and you pick the time for each one. There are two classes on every class day: a lecture and a core skills class.",
  // The marker is split so it arrives across several deltas — the case that
  // makes naive stripping flash "[[HAND" on screen.
  handoff: "I do not have that detail here. [[HAN" + "DOFF]]"
};

function sse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    writeFileSync(`${DIR}stub-last-request.json`, body || "{}");
    const m = mode();

    if (m === "500") {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "boom" } }));
      return;
    }

    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });

    const refusal = m === "refusal";
    const text = refusal ? "" : REPLIES[m] ?? REPLIES.normal;

    sse(res, "message_start", {
      type: "message_start",
      message: {
        id: "msg_stub",
        type: "message",
        role: "assistant",
        model: "claude-opus-5",
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1420, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 1100 }
      }
    });
    sse(res, "content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });

    // Deltas of 5 characters, so the handoff marker is genuinely split.
    let i = 0;
    const tick = () => {
      if (i < text.length) {
        sse(res, "content_block_delta", {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: text.slice(i, i + 5) }
        });
        i += 5;
        setTimeout(tick, 4);
        return;
      }
      sse(res, "content_block_stop", { type: "content_block_stop", index: 0 });
      sse(res, "message_delta", {
        type: "message_delta",
        delta: { stop_reason: refusal ? "refusal" : "end_turn", stop_sequence: null },
        usage: { output_tokens: 42 }
      });
      sse(res, "message_stop", { type: "message_stop" });
      res.end();
    };
    tick();
  });
}).listen(4999, "127.0.0.1", () => console.log("anthropic stub on 4999"));
