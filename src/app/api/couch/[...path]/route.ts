import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const maxDuration = 60;

const knownDbNames = new Set<string>();
const dbEnvCandidates = [
  process.env.COUCHDB_DB,
  process.env.COUCHDB_DB_PHOTOS,
  process.env.COUCHDB_DEFAULT_DB,
  process.env.COUCH_DATABASE,
  process.env.COUCH_DB,
];
for (const candidate of dbEnvCandidates) {
  const value = candidate?.trim();
  if (value) knownDbNames.add(value);
}
const publicDbUrl = process.env.NEXT_PUBLIC_COUCHDB_URL;
if (publicDbUrl) {
  try {
    const url = new URL(publicDbUrl.trim());
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) knownDbNames.add(last);
  } catch {
    // ignore parse errors
  }
}

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function isKnownDbName(value?: string | null) {
  if (!value) return false;
  return knownDbNames.has(value.trim());
}

function resolveCouchBase(requestPath: string[]): string | null {
  const candidates = [
    process.env.COUCH_HOST,
    process.env.COUCHDB_HOST,
    process.env.COUCHDB_URL,
    process.env.COUCH_URL,
    process.env.NEXT_PUBLIC_COUCHDB_URL,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (!url.protocol || !url.host) continue;

      const origin = `${url.protocol}//${url.host}`;
      const pathname = url.pathname.replace(/\/+$/, "");
      if (!pathname) return origin;

      const pathSegments = pathname.split("/").filter(Boolean);
      if (pathSegments.length === 0) {
        return origin;
      }

      const requestFirst = requestPath[0];
      if (requestFirst) {
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (requestFirst === lastSegment) {
          pathSegments.pop();
        } else if (requestFirst.startsWith("_")) {
          const shouldDropLast = pathSegments.length > 1 || isKnownDbName(lastSegment);
          if (shouldDropLast) {
            pathSegments.pop();
          }
        }
      }

      const prefix = pathSegments.length ? `/${pathSegments.join("/")}` : "";
      return `${origin}${prefix}`;
    } catch {
      // Ignore parse errors and try the next candidate.
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.replace(/\/+$/, "");
    }
  }
  return null;
}

function sanitizeSetCookie(raw: string, req: NextRequest): string {
  let cookie = raw.replace(/;\s*Domain=[^;]*/gi, "");
  const protoHeader = req.headers.get("x-forwarded-proto");
  const proto = protoHeader || req.nextUrl.protocol.replace(/:$/, "");
  const host = req.headers.get("host") || req.nextUrl.host;
  const isLocalHttp = proto === "http" && /^localhost(:|$)/i.test(host || "");
  if (isLocalHttp) {
    cookie = cookie.replace(/;\s*Secure/gi, "");
  }
  if (!/;\s*Path=/i.test(cookie)) cookie += "; Path=/";
  if (!/;\s*SameSite=/i.test(cookie)) cookie += "; SameSite=Lax";
  return cookie;
}

function redactCookie(value?: string | null) {
  if (!value) return "";
  return value.replace(/(AuthSession=)([^;]+)/gi, (_match, prefix, token) => {
    if (!token) return `${prefix}<empty>`;
    const head = token.slice(0, 6);
    const tail = token.slice(-4);
    return `${prefix}${head}***${tail}`;
  });
}

async function proxy(req: NextRequest, path: string[]) {
  const targetBase = resolveCouchBase(path);
  if (!targetBase) {
    console.error(
      "[couch-proxy] Missing CouchDB host env (expected COUCH_HOST / COUCHDB_URL / NEXT_PUBLIC_COUCHDB_URL)",
    );
    return NextResponse.json(
      { ok: false, error: "Missing CouchDB host configuration" },
      { status: 500 },
    );
  }

  const search = req.nextUrl.search || "";
  const encodedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const normalizedBase = targetBase.replace(/\/+$/, "");
  const targetPath = encodedPath ? `/${encodedPath}` : "";
  const target = `${normalizedBase}${targetPath}${search}`;

  const headers: Record<string, string> = {};
  const forward = (name: string, headerName?: string) => {
    const value = req.headers.get(name);
    if (value) headers[headerName || name.toLowerCase()] = value;
  };
  forward("content-type");
  forward("if-match");
  forward("if-none-match");
  forward("if-modified-since");
  forward("if-unmodified-since");
  forward("authorization");
  headers["accept"] = req.headers.get("accept") || "application/json";
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) headers["cookie"] = cookieHeader;

  const proxySecret = process.env.COUCHDB_PROXY_SECRET || process.env.COUCH_PROXY_SECRET;
  if (proxySecret) headers["x-proxy-secret"] = proxySecret;

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      const raw = await req.arrayBuffer();
      if (raw && raw.byteLength > 0) {
        body = raw;
      }
    } catch (error) {
      console.warn("[couch-proxy] Unable to read request body", error);
    }
  }

  console.log(
    "[couch-proxy] ->",
    method,
    target,
    "cookie:",
    redactCookie(cookieHeader),
    "secret:",
    proxySecret ? "set" : "absent",
  );

  try {
    const init: RequestInit = {
      method,
      headers,
      redirect: "manual",
    };
    if (hasBody && body) init.body = body;

    const upstreamRes = await fetch(target, init);

    const nextRes = new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
    });

    upstreamRes.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === "set-cookie") return;
      if (hopByHopHeaders.has(lower)) return;
      nextRes.headers.set(key, value);
    });

    const upstreamSetCookie = upstreamRes.headers.get("set-cookie");
    if (upstreamSetCookie) {
      nextRes.headers.set("set-cookie", sanitizeSetCookie(upstreamSetCookie, req));
    }

    nextRes.headers.set("Cache-Control", "no-store");

    console.log(
      "[couch-proxy] <-",
      upstreamRes.status,
      upstreamRes.statusText,
      "set-cookie:",
      redactCookie(upstreamSetCookie),
    );

    return nextRes;
  } catch (error: any) {
    console.error("[couch-proxy] error", error?.stack || error?.message || error);
    return NextResponse.json(
      { ok: false, error: "Proxy error", message: String(error?.message ?? error) },
      { status: 500 },
    );
  }
}

export function GET(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, Array.isArray(params?.path) ? params!.path : []);
}
export function POST(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, Array.isArray(params?.path) ? params!.path : []);
}
export function PUT(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, Array.isArray(params?.path) ? params!.path : []);
}
export function DELETE(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, Array.isArray(params?.path) ? params!.path : []);
}
export function PATCH(req: NextRequest, { params }: { params: { path?: string[] } }) {
  return proxy(req, Array.isArray(params?.path) ? params!.path : []);
}
