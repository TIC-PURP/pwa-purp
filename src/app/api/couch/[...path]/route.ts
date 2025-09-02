// Proxy que redirige las peticiones hacia CouchDB manteniendo cookies y headers
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Función genérica que replica la solicitud original al servidor CouchDB
async function proxy(req: NextRequest, path: string[]) {
  try {
    const targetBase = process.env.COUCH_HOST;
    if (!targetBase) {
      console.error("[couch-proxy] Missing COUCH_HOST env");
      return NextResponse.json({ ok: false, error: "Missing COUCH_HOST env" }, { status: 500 });
    }
    const search = req.nextUrl.search ?? "";
    const target = `${targetBase}/${path.join("/")}${search}`;

    // Transfiere encabezados relevantes
    const headers: Record<string, string> = {};
    const ct = req.headers.get("content-type");
    if (ct) headers["content-type"] = ct;
    const cookie = req.headers.get("cookie");
    if (cookie) headers["cookie"] = cookie;
    // Aceptar JSON por defecto
    headers["accept"] = headers["accept"] || "application/json";

    // Inyectar secreto del proxy si está configurado
    const proxySecret = process.env.COUCHDB_PROXY_SECRET;
    if (proxySecret) headers["x-proxy-secret"] = proxySecret;

    // Utilidad para enmascarar valores sensibles de cookies en logs
    const redact = (val?: string | null) => {
      const s = (val || "").toString();
      return s.replace(/(AuthSession=)([^;]+)/gi, (_m, p1, p2) => {
        if (!p2) return p1 + "<empty>";
        const head = p2.slice(0, 6);
        const tail = p2.slice(-4);
        return `${p1}${head}…${tail}`;
      });
    };

    const method = req.method.toUpperCase();
    console.log(
      "[couch-proxy] ->",
      method,
      target,
      "cookie:", redact(cookie),
      "x-proxy-secret:", proxySecret ? "present" : "absent",
    );

    const hasBody = !["GET", "HEAD"].includes(method);
    const body = hasBody ? await req.text() : undefined;

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

    // Reenvía cookies y tipo de contenido
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

// Métodos HTTP soportados, todos usan la función proxy
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
