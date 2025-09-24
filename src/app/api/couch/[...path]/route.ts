// Proxy que redirige las peticiones hacia CouchDB manteniendo cookies y headers
import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Funcion generica que replica la solicitud original al servidor CouchDB
async function proxy(req: NextRequest, path: string[]) {
  try {
    const targetBase = process.env.COUCH_HOST;
    if (!targetBase) {
      console.error("[couch-proxy] Missing COUCH_HOST env");
      return NextResponse.json({ ok: false, error: "Missing COUCH_HOST env" }, { status: 500 });
    }
    const search = req.nextUrl.search ?? "";
    const target = `${targetBase}/${path.join("/")}${search}`;

    const headers = new Headers();
    req.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === "host" || lower === "connection" || lower === "content-length") {
        return;
      }
      headers.append(key, value);
    });

    const cookieHeader = headers.get("cookie") || "";
    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }

    const proxySecret = process.env.COUCHDB_PROXY_SECRET;
    if (proxySecret) headers.set("x-proxy-secret", proxySecret);

    const redact = (val?: string | null) => {
      const s = (val || "").toString();
      return s.replace(/(AuthSession=)([^;]+)/gi, (_match, prefix, raw) => {
        if (!raw) return prefix + "<empty>";
        const head = raw.slice(0, 6);
        const tail = raw.slice(-4);
        return `${prefix}${head}***${tail}`;
      });
    };

    const method = req.method.toUpperCase();
    console.log(
      "[couch-proxy] ->",
      method,
      target,
      "cookie:", redact(cookieHeader),
      "x-proxy-secret:", proxySecret ? "present" : "absent",
    );

    const hasBody = !["GET", "HEAD"].includes(method);
    let body: BodyInit | undefined;
    if (hasBody) {
      headers.delete("content-length");
      const contentType = headers.get("content-type") || "";
      const isTextBody = /^(?:text\/|application\/(?:json|.*\+json|x-www-form-urlencoded))/i.test(contentType);
      if (isTextBody) {
        const text = await req.text();
        body = text;
        headers.set("content-length", String(Buffer.byteLength(text)));
      } else {
        const arrayBuffer = await req.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        body = new Uint8Array(buffer);
        headers.set("content-length", String(buffer.byteLength));
      }
    }

    const fetchInit: RequestInit = {
      method,
      headers,
      redirect: "manual",
    };
    if (hasBody && body !== undefined) {
      // @ts-ignore: duplex is required by undici when streaming PUT/POST bodies
      fetchInit.duplex = "half";
      fetchInit.body = body;
    }

    const res = await fetch(target, fetchInit);

    const nextRes = new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
    });

    const setCookieHeader = (res.headers as any).getSetCookie?.();
    if (setCookieHeader && Array.isArray(setCookieHeader)) {
      for (const value of setCookieHeader) {
        nextRes.headers.append("set-cookie", value);
      }
    } else {
      const single = res.headers.get("set-cookie");
      if (single) nextRes.headers.set("set-cookie", single);
    }

    const passThroughHeaders = ["content-type", "content-length", "etag", "cache-control", "www-authenticate"];
    for (const headerName of passThroughHeaders) {
      const value = res.headers.get(headerName);
      if (value) {
        nextRes.headers.set(headerName, value);
      }
    }
    nextRes.headers.set("Cache-Control", "no-store");
    return nextRes;
  } catch (e: any) {
    console.error("[couch-proxy] error", e?.message || e);
    return NextResponse.json(
      { ok: false, error: "Proxy error", message: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}

// Metodos HTTP soportados, todos usan la funcion proxy
export function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
