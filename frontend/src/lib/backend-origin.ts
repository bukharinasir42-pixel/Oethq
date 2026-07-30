/** Backend origin for server-side fetches and the /api proxy (not inlined in the client bundle). */
export function getBackendOrigin(): string {
  const raw =
    process.env.API_URL?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    "http://localhost:4000";
  return raw.replace(/^["']|["']$/g, "").replace(/\/+$/, "");
}
