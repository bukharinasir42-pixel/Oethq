/**
 * chat-attachments.ts — images and dictation for the assistant.
 *
 * Both exist for the same reason: the single most useful thing a candidate can
 * give the assistant is their OET score report, and typing four sub-test scores
 * accurately on a phone is exactly the friction that makes people give up.
 */

/** What the API accepts. Anything else is rejected in the browser, with a reason. */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Longest edge after downscaling. Enough to read a score report, cheap to send. */
const MAX_EDGE = 1400;

/** JPEG quality for the re-encode. 0.82 is visually clean and roughly halves size. */
const QUALITY = 0.82;

export type PreparedImage = {
  /** `data:image/jpeg;base64,...` — what the API takes. */
  dataUrl: string;
  /** For the thumbnail in the composer. */
  previewUrl: string;
  name: string;
  bytes: number;
};

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED.includes(file.type);
}

/**
 * Downscale and re-encode before upload.
 *
 * A modern phone photo is 4-12 MB, and every one of those bytes is billed as
 * input tokens. Downscaling to 1400px keeps a score report perfectly legible —
 * that is the whole job — while cutting the payload by roughly ten times. It
 * also strips EXIF, which on a phone photo carries GPS coordinates.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isAcceptedImage(file)) {
    throw new Error("That file type is not supported. Send a JPG, PNG or WebP.");
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("That image could not be read. Try another photo.");
  });

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image on this device.");
  // A white base: a transparent PNG re-encoded to JPEG otherwise goes black,
  // which is exactly what a cropped screenshot tends to be.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  const bytes = Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  if (bytes > 3_500_000) {
    throw new Error("That image is too large even after resizing. Try a screenshot instead.");
  }

  return { dataUrl, previewUrl: dataUrl, name: file.name || "image", bytes };
}

// ---------------------------------------------------------------- dictation

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechCtor = new () => SpeechRecognitionLike;

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictationSupported(): boolean {
  return speechCtor() !== null;
}

export type Dictation = {
  stop: () => void;
};

/**
 * Speak instead of typing, using the browser's own speech recognition.
 *
 * This is dictation, not audio upload, and the distinction is the whole design.
 * The delivered build transcribed voice notes server-side with Whisper, which
 * needs a GPU host — a materially different and much more expensive deployment
 * than the rest of this application. The browser already has a recogniser: no
 * new service, no new vendor, no per-minute cost, and the audio never leaves
 * the device.
 *
 * The trade-off is real and worth stating: it is Chrome, Edge and Safari only
 * (Firefox has nothing), and it is weaker than Whisper on a strong accent —
 * which matters for this audience. So the transcript lands in the input box as
 * editable text rather than being sent, and the button is simply absent where
 * the browser cannot do it.
 */
export function startDictation(opts: {
  lang?: string;
  onText: (text: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}): Dictation | null {
  const Ctor = speechCtor();
  if (!Ctor) return null;

  let recogniser: SpeechRecognitionLike;
  try {
    recogniser = new Ctor();
  } catch {
    return null;
  }

  recogniser.lang = opts.lang || (typeof navigator !== "undefined" ? navigator.language : "en-US") || "en-US";
  recogniser.continuous = true;
  recogniser.interimResults = true;

  recogniser.onresult = (e) => {
    let finalText = "";
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const text = r[0]?.transcript ?? "";
      if (r.isFinal) finalText += text;
      else interim += text;
    }
    if (finalText) opts.onText(finalText, true);
    else if (interim) opts.onText(interim, false);
  };

  recogniser.onerror = (e) => {
    const code = e?.error ?? "";
    if (code === "not-allowed" || code === "service-not-allowed") {
      opts.onError?.("Microphone access was blocked. Allow it in your browser settings, or type instead.");
    } else if (code === "no-speech") {
      opts.onError?.("I didn't catch anything. Try again, or type it.");
    } else if (code !== "aborted") {
      opts.onError?.("Dictation stopped. You can type instead.");
    }
    opts.onEnd?.();
  };

  recogniser.onend = () => opts.onEnd?.();

  try {
    recogniser.start();
  } catch {
    opts.onError?.("Could not start dictation on this browser.");
    return null;
  }

  return {
    stop: () => {
      try {
        recogniser.stop();
      } catch {
        /* already stopped */
      }
    }
  };
}
