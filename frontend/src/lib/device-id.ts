/**
 * Device identity for the two-device limit.
 *
 * Two values travel on every request:
 *
 *   x-device-id — a random id minted once and kept in localStorage. Stable and
 *                 exact while the browser keeps its data.
 *   x-device-fp — a hash of traits that survive clearing site data (platform,
 *                 screen geometry, timezone, language, GPU renderer, CPU/memory
 *                 class, touch support).
 *
 * The server matches on the id first and falls back to the fingerprint, so a
 * student who clears their browser is re-linked to the same session instead of
 * silently spending their second slot — and a private window cannot be used to
 * claim a third device.
 *
 * Deliberately coarse. Nothing here identifies a person: no canvas pixel
 * readback, no audio probe, no font enumeration. It distinguishes *this laptop*
 * from *that phone* for the same signed-in account, and does not follow anyone
 * around. Two identical phones on the same account can collide, which costs at
 * most a re-link, and it is never used to identify a signed-out visitor.
 */

const ID_KEY = "oet_device_id";
const FP_KEY = "oet_device_fp";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `d-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Stable per-browser id, minted on first use. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    // Private mode with storage denied — the fingerprint alone still works.
    return "";
  }
}

/** WebGL renderer string, which separates a phone from a laptop well. */
function gpu(): string {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") || c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "") : "";
  } catch {
    return "";
  }
}

/** Small synchronous string hash — enough to key a row, not a secret. */
function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return (h1.toString(36) + h2.toString(36)).slice(0, 24);
}

/**
 * Hash of traits that survive clearing site data. Cached in localStorage purely
 * to save the WebGL call; it is recomputed whenever that cache is gone, which is
 * exactly the case it exists to cover.
 */
export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") return "";
  try {
    const cached = localStorage.getItem(FP_KEY);
    if (cached) return cached;
  } catch {
    /* storage denied — compute it every time */
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  const traits = [
    nav.platform ?? "",
    nav.language ?? "",
    String(nav.hardwareConcurrency ?? ""),
    String(nav.deviceMemory ?? ""),
    String(nav.maxTouchPoints ?? ""),
    // Screen geometry, not window size: resizing a window must not look like a
    // new device.
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(window.devicePixelRatio ?? ""),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    gpu()
  ].join("|");

  const fp = hash(traits);
  try {
    localStorage.setItem(FP_KEY, fp);
  } catch {
    /* nothing to do */
  }
  return fp;
}

/** Headers to attach to every API request. */
export function deviceHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  const id = getDeviceId();
  const fp = getDeviceFingerprint();
  if (id) out["x-device-id"] = id;
  if (fp) out["x-device-fp"] = fp;
  return out;
}
