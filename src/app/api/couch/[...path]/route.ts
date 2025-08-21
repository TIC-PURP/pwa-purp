import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const couchBase = process.env.COUCH_HOST!; // e.g. http://host:5984

export async function POST(req: NextRequest) {
  // Forward body as-is (x-www-form-urlencoded)
  const body = await req.text();

  const couchRes = await fetch(`${couchBase}/_session`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  });

  const couchSetCookie = couchRes.headers.get("set-cookie");
  const data = await couchRes.json().catch(() => ({}));

  // Mirror status/body to the browser
  const res = NextResponse.json(data, { status: couchRes.status });

  // Re-emit CouchDB's AuthSession cookie so the browser stores it for our domain
  if (couchSetCookie) {
    const first = couchSetCookie.split(",")[0]; // take first cookie only
    // Normalize Path and ensure useful defaults
    const normalized = first.replace(/Path=\/[^;]*/i, "Path=/");
      const addSecure = process.env.VERCEL_URL ? "; Secure" : "";
  res.headers.set(
    "Set-Cookie",
    normalized + "; Path=/; SameSite=Lax; HttpOnly" + addSecure,
  );
  }

  return res;
}

// Allows checking current session (mirrors CouchDB /_session)
export async function GET() {
  const cookieHeader = cookies().toString(); // includes AuthSession if present

  const couchRes = await fetch(`${couchBase}/_session`, {
    headers: { cookie: cookieHeader },
  });

  const data = await couchRes.json().catch(() => ({}));
  return NextResponse.json(data, { status: couchRes.status });
}
