export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

function target(req: NextRequest, segs: string[]) {
  const base = process.env.COUCH_HOST;
  if (!base) throw new Error("Falta variable COUCH_HOST");
  const path = segs.join("/");
  const q = req.nextUrl.search || "";
  return `${base}/${path}${q}`;
}

function fwdHeaders(req: NextRequest) {
  const h = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);
  const ck = req.headers.get("cookie");
  if (ck) h.set("cookie", ck);
  h.set("accept", "application/json, text/plain, */*");
  return h;
}

function fwdSetCookie(res: Response, out: NextResponse) {
  const set = (res.headers as any).getSetCookie?.() ?? [];
  for (const c of set) out.headers.append("set-cookie", c);
}

async function handler(req: NextRequest, ctx: { params: { path: string[] } }) {
  try {
    const url = target(req, ctx.params.path);
    let body: BodyInit | undefined = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const ab = await req.arrayBuffer();
      body = new Uint8Array(ab);
    }
    const r = await fetch(url, { method: req.method, headers: fwdHeaders(req), body });
    const buf = await r.arrayBuffer();
    const out = new NextResponse(buf, { status: r.status });
    for (const [k, v] of r.headers) {
      const kl = k.toLowerCase();
      if (kl !== "set-cookie" && kl !== "content-length") out.headers.set(k, v);
    }
    fwdSetCookie(r, out);
    return out;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "proxy" }, { status: 500 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH, handler as OPTIONS, handler as HEAD };
