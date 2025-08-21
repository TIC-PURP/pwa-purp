import { NextRequest, NextResponse } from "next/server";

const couchBase = process.env.COUCH_HOST!; // e.g. http://host:5984

export async function POST(req: NextRequest) {
  const body = await req.text();

  const couchRes = await fetch(`${couchBase}/_session`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  });

  const couchSetCookie = couchRes.headers.get("set-cookie");
  let data: any = {};
  try { data = await couchRes.json(); } catch {}

  const res = NextResponse.json(data, { status: couchRes.status });

  if (couchSetCookie) {
    const first = couchSetCookie.split(",")[0];
    const normalized = first.replace(/Path=\/[^;]*/i, "Path=/");
    const addSecure = process.env.VERCEL_URL ? "; Secure" : "";
    res.headers.set(
      "Set-Cookie",
      normalized + "; Path=/; SameSite=Lax; HttpOnly" + addSecure
    );
  }
  return res;
}

export async function GET() {
  const res = await fetch(`${couchBase}/_session`, {
    headers: {},
    credentials: "include" as any,
  });
  let data: any = {};
  try { data = await res.json(); } catch {}
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(req: NextRequest) {
  const cookie = req.headers.get("cookie") || "";
  await fetch(`${couchBase}/_session`, {
    method: "DELETE",
    headers: { cookie },
  }).catch(() => {});

  const res = NextResponse.json({ ok: true });
  const secure = process.env.VERCEL_URL ? "; Secure" : "";
  res.headers.set("Set-Cookie", `AuthSession=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure}`);
  return res;
}
