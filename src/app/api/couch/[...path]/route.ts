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

    const headers: Record<string, string> = {};
    const ct = req.headers.get("content-type");
    if (ct) headers["content-type"] = ct;
    const cookie = req.headers.get("cookie");
    if (cookie) headers["cookie"] = cookie;

    // Read body explicitly; passing req.body directly causes 500 in some runtimes
    const method = req.method.toUpperCase();
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

    // forward relevant headers
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) nextRes.headers.set("set-cookie", setCookie);
    const resCT = res.headers.get("content-type");
    if (resCT) nextRes.headers.set("content-type", resCT);
    nextRes.headers.set("Cache-Control", "no-store");

    return nextRes;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "Proxy error", message },
      { status: 500 }
    );
  }
}

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
