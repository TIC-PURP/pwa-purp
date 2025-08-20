export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function buildTargetURL(req: NextRequest, pathParam: string[]) {
  const base = process.env.COUCH_HOST;
  if (!base) throw new Error("Falta variable COUCH_HOST");
  const path = pathParam.join("/");
  const search = req.nextUrl.search || "";
  return `${base}/${path}${search}`;
}

function filterRequestHeaders(req: NextRequest) {
  const h = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);
  h.set("accept", "application/json, text/plain, */*");
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  return h;
}

function forwardSetCookie(res: Response, out: NextResponse) {
  const setCookies = (res.headers as any).getSetCookie?.() ?? [];
  for (const c of setCookies) out.headers.append("set-cookie", c);
}

export async function ALL(req: NextRequest, { params }: { params: { path: string[] } }) {
  try {
    const url = buildTargetURL(req, params.path);

    // ⬇️ FIX: usar Uint8Array (BodyInit válido) en lugar de Buffer
    let body: BodyInit | undefined = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const ab = await req.arrayBuffer();
      body = new Uint8Array(ab); // ✅ BodyInit
    }

    const res = await fetch(url, {
      method: req.method,
      headers: filterRequestHeaders(req),
      body
    });

    // Devolver el cuerpo tal cual
    const buf = await res.arrayBuffer();
    const out = new NextResponse(buf, { status: res.status });

    for (const [k, v] of res.headers) {
      const kl = k.toLowerCase();
      if (kl === "set-cookie" || kl === "content-length") continue;
      out.headers.set(k, v);
    }
    forwardSetCookie(res, out);
    return out;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Proxy error" }, { status: 500 });
  }
}

export const GET = ALL;
export const POST = ALL;
export const PUT = ALL;
export const DELETE = ALL;
export const HEAD = ALL;
export const PATCH = ALL;
export const OPTIONS = ALL;
