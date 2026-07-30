import { getBackendOrigin } from "./backend-origin";
import type { UserProfile } from "./types";

/**
 * Base URL for JSON API calls.
 * - In the browser: always `NEXT_PUBLIC_API_BASE` (inlined at build time).
 * - On the server (RSC, route handlers): prefers `API_URL` / `BACKEND_URL` via {@link getBackendOrigin}.
 */
function getApiBase(): string {
  if (typeof window === "undefined") {
    const internal = process.env.API_URL?.trim() || process.env.BACKEND_URL?.trim();
    if (internal) return getBackendOrigin();
  }
  let raw = (process.env.NEXT_PUBLIC_API_BASE || "/api").trim();
  raw = raw.replace(/^["']|["']$/g, "");
  return raw.replace(/\/+$/, "");
}

let warnedSameOrigin = false;

function usesSameOriginApiProxy(base: string): boolean {
  return base === "/api" || base.endsWith("/api");
}

function warnIfApiBasePointsAtThisNextApp() {
  if (warnedSameOrigin || typeof window === "undefined" || process.env.NODE_ENV === "production") {
    return;
  }
  try {
    const base = getApiBase();
    if (usesSameOriginApiProxy(base)) {
      return;
    }
    if (new URL(base, window.location.origin).origin === window.location.origin) {
      warnedSameOrigin = true;
      // eslint-disable-next-line no-console
      console.warn(
        "[api] NEXT_PUBLIC_API_BASE points at this Next.js origin without /api proxy. Use NEXT_PUBLIC_API_BASE=/api and set API_URL to your backend (see .env.example), or point at the API host directly in local dev."
      );
    }
  } catch {
    /* ignore invalid URL */
  }
}

function joinApiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBase()}${p}`;
}

/** Large multipart uploads can bypass the Next.js /api proxy when a direct backend URL is set. */
function getUploadApiBase(preferServerUpload?: boolean): string {
  if (!preferServerUpload || typeof window === "undefined") {
    return getApiBase();
  }
  const direct =
    process.env.NEXT_PUBLIC_BACKEND_UPLOAD_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  if (direct) {
    return direct.replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  }
  return getApiBase();
}

function joinUploadApiUrl(path: string, preferServerUpload?: boolean): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getUploadApiBase(preferServerUpload)}${p}`;
}

type Options = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  token?: string | null;
  /** Keep the request alive during page unload (refresh / close). */
  keepalive?: boolean;
};

type PresignedUploadResponse = {
  uploadUrl: string;
  objectKey: string;
  bucket: string;
  contentType: string;
  expiresIn: number;
  title?: string;
};

const DIRECT_UPLOAD_KINDS = new Set(["AUDIO", "VIDEO"]);
const MULTIPART_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

export type ApiUploadOptions = Pick<Options, "token" | "method"> & {
  onProgress?: (percent: number) => void;
  /** Upload through the API server instead of a browser PUT to S3 (avoids CORS / IAM issues). */
  preferServerUpload?: boolean;
};

function reportProgress(onProgress: ApiUploadOptions["onProgress"], percent: number) {
  onProgress?.(Math.min(100, Math.max(0, Math.round(percent))));
}

function xhrSend(
  url: string,
  method: string,
  body: XMLHttpRequestBodyInit,
  headers: Record<string, string>,
  onProgress?: (percent: number) => void
): Promise<{ status: number; responseText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => resolve({ status: xhr.status, responseText: xhr.responseText });
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(body);
  });
}

function parseApiErrorMessage(text: string) {
  let message = text;
  try {
    const parsed = JSON.parse(text);
    message = parsed.message || parsed.error || text;
  } catch {
    // ignore JSON parse errors — fall through to XML / plain text handling
  }

  const xmlMessage = message.match(/<Message>([^<]+)<\/Message>/i)?.[1]?.trim();
  if (xmlMessage) {
    const xmlCode = message.match(/<Code>([^<]+)<\/Code>/i)?.[1]?.trim();
    return xmlCode ? `${xmlCode}: ${xmlMessage}` : xmlMessage;
  }

  return message;
}

function shouldUsePresignedUpload(path: string, file: File, preferServerUpload?: boolean) {
  if (preferServerUpload) return false;
  const kindMatch = path.match(/\/storage\/upload\/([^/]+)/i);
  const kind = kindMatch?.[1]?.toUpperCase();
  if (kind && DIRECT_UPLOAD_KINDS.has(kind)) return true;
  return file.size > MULTIPART_UPLOAD_MAX_BYTES;
}

async function uploadViaPresignedUrl<T>(
  path: string,
  file: File,
  formData: FormData,
  options: ApiUploadOptions = {}
): Promise<T> {
  const kindMatch = path.match(/\/storage\/upload\/([^/]+)/i);
  const kind = kindMatch?.[1];
  if (!kind) {
    throw new Error("Invalid upload path");
  }

  const title = formData.get("title")?.toString().trim() || file.name;
  const dayNumberRaw = formData.get("dayNumber");
  const slot = formData.get("slot")?.toString();
  const contentType = file.type || "application/octet-stream";

  const presignBody: Record<string, string | number> = {
    title,
    filename: file.name,
    contentType
  };
  if (slot) presignBody.slot = slot;
  if (dayNumberRaw != null && String(dayNumberRaw).trim() !== "") {
    presignBody.dayNumber = Number(dayNumberRaw);
  }

  reportProgress(options.onProgress, 3);

  const presigned = await apiFetch<PresignedUploadResponse>(`/storage/presign/${kind}`, {
    method: "POST",
    token: options.token,
    body: presignBody
  });

  reportProgress(options.onProgress, 8);

  const putResponse = await xhrSend(
    presigned.uploadUrl,
    "PUT",
    file,
    { "Content-Type": presigned.contentType },
    (filePercent) => reportProgress(options.onProgress, 8 + Math.round(filePercent * 0.84))
  );

  if (putResponse.status < 200 || putResponse.status >= 300) {
    throw new Error(
      parseApiErrorMessage(putResponse.responseText) ||
        "Direct upload to storage failed. Check S3/MinIO CORS allows PUT from this site."
    );
  }

  reportProgress(options.onProgress, 95);

  const asset = await apiFetch<T>(`/storage/complete/${kind}`, {
    method: "POST",
    token: options.token,
    body: {
      objectKey: presigned.objectKey,
      title: presigned.title || title,
      contentType: presigned.contentType,
      sizeBytes: file.size
    }
  });

  reportProgress(options.onProgress, 100);
  return asset;
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  warnIfApiBasePointsAtThisNextApp();
  const { body, token, ...rest } = options;
  const headers: Record<string, string> = {
    ...rest.headers
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  /** `undefined`: use stored token; `null`: anonymous (no Authorization). */
  const bearer = token === undefined ? getToken() : token;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const res = await fetch(joinApiUrl(path), {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    keepalive: rest.keepalive
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(parseApiErrorMessage(text) || "Request failed");
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json();
  }
  // @ts-expect-error allow string return
  return res.text();
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: ApiUploadOptions = {}
): Promise<T> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Missing file field");
  }

  if (shouldUsePresignedUpload(path, file, options.preferServerUpload)) {
    return uploadViaPresignedUrl<T>(path, file, formData, options);
  }

  warnIfApiBasePointsAtThisNextApp();
  const headers: Record<string, string> = {};
  const bearer = options.token === undefined ? getToken() : options.token;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  reportProgress(options.onProgress, 0);

  const response = await xhrSend(
    joinUploadApiUrl(path, options.preferServerUpload),
    options.method || "POST",
    formData,
    headers,
    options.onProgress
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(parseApiErrorMessage(response.responseText) || "Upload failed");
  }

  reportProgress(options.onProgress, 100);
  return JSON.parse(response.responseText) as T;
}

const TOKEN_KEY = "oet_token";
const USER_KEY = "oet_user";

/** Fired when auth token/user is written or cleared so all useSession hooks stay in sync. */
export const SESSION_CHANGED_EVENT = "oet-session-changed";

function notifySessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export type StoredUser = {
  email: string;
  name: string;
  role?: string;
};

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  notifySessionChanged();
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredUser(user: StoredUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifySessionChanged();
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredUser;
    if (typeof parsed.email === "string" || typeof parsed.name === "string") {
      return {
        email: parsed.email ?? "",
        name: parsed.name ?? "",
        role: parsed.role
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearStoredUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  notifySessionChanged();
}

export function clearToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifySessionChanged();
}

/** Clear client auth storage and hard-navigate so all React state resets. */
export function signOut(redirectTo = "/") {
  clearToken();
  if (typeof window === "undefined") return;
  window.location.assign(redirectTo);
}

export function isAuthErrorMessage(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("unauthorized") || lower.includes("invalid or expired token");
}

export async function persistAuthSession(
  response: {
    accessToken: string;
    email?: string | null;
    name?: string | null;
    role?: string;
  },
  fallbacks?: { email?: string; name?: string }
) {
  setToken(response.accessToken);

  let email = response.email?.trim() || fallbacks?.email?.trim() || "";
  let name = response.name?.trim() || fallbacks?.name?.trim() || "";
  let role = response.role;

  if (!email || !name) {
    try {
      const me = await apiFetch<UserProfile>("/auth/me", { token: response.accessToken });
      email = me.email || email;
      name = me.name || name;
      role = role ?? me.role;
    } catch {
      // Keep whatever we already have from the login response or form.
    }
  }

  setStoredUser({ email, name, role });
}

export function getPostAuthRedirect(
  role: string | undefined,
  returnTo: string | null,
  options?: { accessGranted?: boolean }
) {
  const checkoutReturn =
    Boolean(returnTo) &&
    (returnTo!.startsWith("/checkout") || returnTo!.includes("/checkout?"));
  const portalReturn = Boolean(returnTo) && returnTo!.startsWith("/portal");

  // Active candidates should not be sent back into payment after login.
  if (role === "CANDIDATE" && options?.accessGranted && checkoutReturn) {
    return "/portal";
  }

  // No active plan: send candidates to home (plans), not the portal.
  if (role === "CANDIDATE" && !options?.accessGranted) {
    if (checkoutReturn) return returnTo!;
    return "/#packages";
  }

  if (returnTo && !portalReturn) return returnTo;
  if (role === "ADMIN") return "/admin";
  if (role === "CANDIDATE") {
    return options?.accessGranted ? "/portal" : "/#packages";
  }
  return "/portal";
}
