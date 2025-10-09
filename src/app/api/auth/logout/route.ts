import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveCouchBase(): string | null {
  const candidates = [
    process.env.COUCH_HOST,
    process.env.COUCHDB_HOST,
    process.env.COUCHDB_URL,
    process.env.COUCH_URL,
    process.env.NEXT_PUBLIC_COUCHDB_URL,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      const url = new URL(raw);
      if (url.protocol && url.host) {
        return `${url.protocol}//${url.host}`;
      }
    } catch {
      // Ignore parse errors and keep looking for other candidates.
    }
    if (/^https?:\/\//i.test(raw)) {
      return raw.replace(/\/+$/, "");
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
  } else if (!/;\s*Secure/gi.test(cookie)) {
    cookie += "; Secure";
  }
  if (!/;\s*Path=/i.test(cookie)) cookie += "; Path=/";
  if (!/;\s*SameSite=/i.test(cookie)) cookie += "; SameSite=Lax";
  if (!/;\s*HttpOnly/i.test(cookie)) cookie += "; HttpOnly";
  return cookie;
}

function buildRemovalCookie(req: NextRequest): string {
  const protoHeader = req.headers.get("x-forwarded-proto");
  const proto = protoHeader || req.nextUrl.protocol.replace(/:$/, "");
  const host = req.headers.get("host") || req.nextUrl.host;
  const isLocalHttp = proto === "http" && /^localhost(:|$)/i.test(host || "");
  const attrs = ["Path=/", "SameSite=Lax", "Max-Age=0", "HttpOnly"];
  if (!isLocalHttp) attrs.push("Secure");
  return `AuthSession=; ${attrs.join("; ")}`;
}

function extractCookieValue(headerValue: string | null, name: string): string | null {
  if (!headerValue) return null;
  const needle = `${name.toLowerCase()}=`;
  const parts = headerValue.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.toLowerCase().startsWith(needle)) {
      return part.slice(needle.length);
    }
  }
  return null;
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

async function handleLogout(req: NextRequest) {
  const cookieHeader = req.headers.get("cookie");
  const authSessionValue = extractCookieValue(cookieHeader, "AuthSession");
  const base = resolveCouchBase();
  const proxySecret = process.env.COUCHDB_PROXY_SECRET || process.env.COUCH_PROXY_SECRET;

  let upstreamStatus: number | null = null;
  let upstreamBody: any = null;
  let upstreamError: string | null = null;
  let upstreamSetCookie: string | null = null;

  if (base && authSessionValue) {
    const headers: Record<string, string> = {
      accept: "application/json",
      cookie: `AuthSession=${authSessionValue}`,
    };
    if (proxySecret) headers["x-proxy-secret"] = proxySecret;

    try {
      console.log(
        "[logout] -> DELETE",
        `${base}/_session`,
        "cookie:",
        redactCookie(headers.cookie),
        "secret:",
        proxySecret ? "set" : "absent",
      );
      const res = await fetch(`${base.replace(/\/+$/, "")}/_session`, {
        method: "DELETE",
        headers,
        redirect: "manual",
      });
      upstreamStatus = res.status;
      upstreamSetCookie = res.headers.get("set-cookie");
      const text = await res.text();
      try {
        upstreamBody = text ? JSON.parse(text) : {};
      } catch {
        upstreamBody = text;
      }
      console.log(
        "[logout] <-",
        res.status,
        res.statusText,
        "set-cookie:",
        redactCookie(upstreamSetCookie),
      );
    } catch (error: any) {
      upstreamError = error?.message || String(error);
      console.error("[logout] upstream error", upstreamError);
    }
  } else if (!base) {
    upstreamError = "CouchDB host env not configured";
    console.error("[logout] Missing CouchDB host configuration");
  }

  const response = NextResponse.json(
    {
      ok: true,
      upstreamStatus,
      upstreamError,
    },
    {
      status: upstreamStatus && upstreamStatus >= 400 ? upstreamStatus : 200,
    },
  );

  if (upstreamSetCookie) {
    response.headers.set("set-cookie", sanitizeSetCookie(upstreamSetCookie, req));
  } else {
    response.headers.set("set-cookie", buildRemovalCookie(req));
  }
  response.headers.set("Cache-Control", "no-store");

  return response;
}

export function POST(req: NextRequest) {
  return handleLogout(req);
}

export const DELETE = POST;

