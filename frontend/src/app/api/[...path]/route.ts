import { NextRequest, NextResponse } from "next/server";
import { getBackendOrigin } from "@/lib/backend-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

async function proxyRequest(req: NextRequest, pathSegments: string[]) {
  const backendOrigin = getBackendOrigin();
  const path = pathSegments.join("/");
  const targetUrl = `${backendOrigin}/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase())) return;
      responseHeaders.set(key, value);
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("[api-proxy] upstream connection failed", { targetUrl, err });
    return NextResponse.json(
      {
        error: "Backend unavailable",
        message: "Could not reach the API server. The ECS task IP may have changed — update API_URL on Vercel.",
      },
      { status: 502 },
    );
  }
}

type RouteContext = { params: { path: string[] } };

function handler(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, ctx.params.path ?? []);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
