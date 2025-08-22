import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const targetBase = process.env.COUCH_HOST;
  if (!targetBase) {
    return NextResponse.json({ ok:false, error:"Missing COUCH_HOST" }, { status:500 });
  }
  let payload: any;
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    payload = await req.json();
  } else {
    const txt = await req.text();
    payload = Object.fromEntries(new URLSearchParams(txt));
  }

  const body = new URLSearchParams();
  if (payload.name) body.set("name", payload.name);
  if (payload.password) body.set("password", payload.password);

  // 1) login -> get Set-Cookie (AuthSession)
  const loginRes = await fetch(`${targetBase}/_session`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });

  const setCookie = loginRes.headers.get("set-cookie");
  const loginJSON = await loginRes.json().catch(() => ({} as any));

  // Bubble cookie to browser
  const initHeaders: Record<string, string> = { "Cache-Control": "no-store" };
  if (setCookie) initHeaders["set-cookie"] = setCookie;

  // If login failed, return as-is
  if (!loginRes.ok) {
    return new NextResponse(JSON.stringify(loginJSON || { ok:false }), {
      status: loginRes.status,
      headers: initHeaders,
    });
  }

  // 2) fetch session using same cookie to get name/roles
  let sessionData: any = null;
  try {
    const who = await fetch(`${targetBase}/_session`, { headers: setCookie ? { cookie: setCookie } : undefined });
    sessionData = await who.json();
  } catch {}

  const responseBody = JSON.stringify({ ok: true, login: loginJSON, session: sessionData });
  return new NextResponse(responseBody, { status: 200, headers: initHeaders });
}
