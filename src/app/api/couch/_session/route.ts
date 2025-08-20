import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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
    res.headers.set("Set-Cookie", normalized + "; SameSite=Lax; HttpOnly");
  }
  return res;
}

export async function GET() {
  const cookieHeader = cookies().toString();
  const couchRes = await fetch(`${couchBase}/_session`, {
    headers: { cookie: cookieHeader },
  });
  let data: any = {};
  try { data = await couchRes.json(); } catch {}
  return NextResponse.json(data, { status: couchRes.status });
}
