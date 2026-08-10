import { chunkConversation, chunkDocument, chunkQaJson, redact } from "./chunker";

/**
 * The knowledge base is read out to whoever is chatting. Anything that survives
 * ingest can be surfaced to a stranger, so redaction is tested on every format
 * — not just the raw-chat one that happened to have it first.
 */

const COMPANY = ["oethq.com"];

describe("redact", () => {
  it("removes a customer's email", () => {
    expect(redact("write to fatima.s@gmail.com please", COMPANY)).toBe("write to [email] please");
  });
  it("keeps our own address, which the assistant needs to give out", () => {
    expect(redact("email support@oethq.com", COMPANY)).toBe("email support@oethq.com");
    expect(redact("email help@mail.oethq.com", COMPANY)).toBe("email help@mail.oethq.com");
  });
  it("removes phone numbers in the shapes people actually write them", () => {
    for (const n of ["+923001234567", "+92 300 1234567", "0300-1234567", "(044) 7911 123456"]) {
      expect(redact(`call me on ${n}`, COMPANY)).not.toContain("123");
    }
  });
  it("leaves ordinary numbers alone", () => {
    expect(redact("the course runs for 60 days and costs 199", COMPANY)).toBe(
      "the course runs for 60 days and costs 199"
    );
  });
});

describe("redaction covers every ingest format", () => {
  const email = "student.private@gmail.com";
  const phone = "+923001234567";

  it("a question and answer list", () => {
    const out = chunkQaJson(
      JSON.stringify([{ question: `Can you email me at ${email}?`, answer: `Sure, or call ${phone}.` }])
    );
    const all = out.map((c) => `${c.heading} ${c.content}`).join(" ");
    expect(all).not.toContain(email);
    expect(all).not.toContain("923001234567");
  });

  it("a document", () => {
    const out = chunkDocument(
      `## Contact\n\n${"Reach the team any time. ".repeat(8)}Write to ${email} or call ${phone} for help.`
    );
    const all = out.map((c) => c.content).join(" ");
    expect(all).not.toContain(email);
    expect(all).not.toContain("923001234567");
  });

  it("a chat export", () => {
    const lines = [
      `[12/03/2026, 14:22:01] Aisha: my email is ${email}`,
      `[12/03/2026, 14:23:01] OET HQ: noted`,
      `[12/03/2026, 14:24:01] Aisha: and my number is ${phone}`,
      `[12/03/2026, 14:25:01] OET HQ: thank you`,
      `[12/03/2026, 14:26:01] Aisha: when do classes start`,
      `[12/03/2026, 14:27:01] OET HQ: you choose four class days a week`
    ].join("\n");
    const all = chunkConversation(lines).map((c) => c.content).join(" ");
    expect(all).not.toContain(email);
    expect(all).not.toContain("923001234567");
    expect(all).toContain("four class days");
  });
});
