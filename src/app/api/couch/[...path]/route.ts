// Proxy que redirige las peticiones hacia CouchDB manteniendo cookies y headers
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
      headers.set(key, value);
    });

    const cookieHeader = headers.get("cookie");
    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }

    const proxySecret = process.env.COUCHDB_PROXY_SECRET;
    if (proxySecret) headers.set("x-proxy-secret", proxySecret);

    const redact = (val?: string | null) => {
      const s = (val || "").toString();
      return s.replace(/(AuthSession=)([^;]+)/gi, (_m, p1, p2) => {
        if (!p2) return p1 + "<empty>";
        const head = p2.slice(0, 6);
        const tail = p2.slice(-4);
        return `${p1}${head}***${tail}`;
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
        body = await req.text();
      } else {
        const buffer = await req.arrayBuffer();
        body = buffer;
        if (buffer.byteLength && !headers.has("content-length")) {
          headers.set("content-length", String(buffer.byteLength));
        }
      }
    }

    const res = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
    });

    const nextRes = new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
    });

    const setCookie = res.headers.get("set-cookie");
    if (setCookie) nextRes.headers.set("set-cookie", setCookie);
    console.log("[couch-proxy] <-", res.status, res.statusText, "set-cookie:", redact(setCookie));
    const resCT = res.headers.get("content-type");
    if (resCT) nextRes.headers.set("content-type", resCT);
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

