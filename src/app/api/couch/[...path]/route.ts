import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function proxy(req: NextRequest, path: string[]) {
  try {
    const targetBase = process.env.COUCH_HOST;
    if (!targetBase) {
      return NextResponse.json({ ok: false, error: "Missing COUCH_HOST env" }, { status: 500 });
    }
    const search = req.nextUrl.search ?? "";
    const target = `${targetBase}/${path.join("/")}${search}`;
    const headers: Record<string,string> = {};
    const ct = req.headers.get("content-type");
    if (ct) headers["content-type"] = ct;
    const cookie = req.headers.get("cookie");
    if (cookie) headers["cookie"] = cookie;
    const method = req.method.toUpperCase();
    const hasBody = !["GET","HEAD"].includes(method);
    const body = hasBody ? await req.text() : undefined;
    const res = await fetch(target, { method, headers, body, redirect:"manual" });
    const nextRes = new NextResponse(res.body, { status: res.status, statusText: res.statusText });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) nextRes.headers.set("set-cookie", setCookie);
    const resCT = res.headers.get("content-type");
    if (resCT) nextRes.headers.set("content-type", resCT);
    nextRes.headers.set("Cache-Control", "no-store");
    return nextRes;
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:"Proxy error", message: String(e?.message ?? e) }, { status: 500 });
  }
}
export function GET(req: NextRequest, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export function POST(req: NextRequest, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export function PUT(req: NextRequest, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
export function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) { return proxy(req, params.path); }
