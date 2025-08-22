import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const base = process.env.COUCH_HOST;
    if (!base) return NextResponse.json({ ok:false, error:"Missing COUCH_HOST" }, { status:500 });

    const ct = req.headers.get("content-type") || "";
    let bodyText = "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      bodyText = await req.text();
    } else if (ct.includes("application/json")) {
      const j = await req.json();
      const p = new URLSearchParams(j as any);
      bodyText = p.toString();
    } else {
      bodyText = await req.text();
    }

    const loginRes = await fetch(`${base}/_session`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: bodyText,
      redirect: "manual",
    });

    const setCookie = loginRes.headers.get("set-cookie") ?? undefined;
    const loginJson = await loginRes.json().catch(() => ({} as any));

    const sessionRes = await fetch(`${base}/_session`, {
      method: "GET",
      headers: setCookie ? { cookie: setCookie } : undefined,
    });
    const sessionJson = await sessionRes.json().catch(() => ({} as any));

    const resp = NextResponse.json(
      { ok: loginRes.ok && sessionRes.ok, login: loginJson, session: sessionJson },
      { status: loginRes.ok ? 200 : loginRes.status }
    );
    if (setCookie) resp.headers.set("set-cookie", setCookie);
    resp.headers.set("Cache-Control", "no-store");
    return resp;
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:"auth-login-failed", message: String(e?.message ?? e) }, { status:500 });
  }
}
