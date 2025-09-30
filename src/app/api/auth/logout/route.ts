import { NextRequest, NextResponse } from "next/server";

function buildExpiredCookie(proto: string, host: string) {
  const parts = [
    "AuthSession=",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Path=/",
    "SameSite=Lax",
    "HttpOnly",
  ];
  const isSecure = proto === "https" && Boolean(host);
  if (isSecure) parts.push("Secure");
  return parts.join("; ");
}

async function handle(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "";
  const origin = `${proto}://${host}`;
  const cookie = req.headers.get("cookie") || "";
  const expireCookie = buildExpiredCookie(proto, host);

  try {
    const couchRes = await fetch(`${origin}/api/couch/_session`, {
      method: "DELETE",
      headers: cookie ? { cookie } : undefined,
      redirect: "manual",
    });

    let setCookie = couchRes.headers.get("set-cookie") || "";
    if (setCookie) {
      setCookie = setCookie.replace(/;\s*Domain=[^;]*/gi, "");
      const isLocal = proto === "http" && /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
      if (isLocal) {
        setCookie = setCookie.replace(/;\s*Secure/gi, "");
      }
      if (!/;\s*Path=/i.test(setCookie)) setCookie += "; Path=/";
      if (!/;\s*SameSite=/i.test(setCookie)) setCookie += "; SameSite=Lax";
    }

    const data = await couchRes.json().catch(() => ({}));
    const ok = couchRes.ok || couchRes.status === 401 || couchRes.status === 403;
    const status = ok ? 200 : couchRes.status || 500;
    const res = NextResponse.json({ ok, data }, { status });
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("set-cookie", setCookie || expireCookie);
    return res;
  } catch (error) {
    console.error("[auth/logout] unexpected", (error as any)?.message || error);
    const res = NextResponse.json({ ok: false, error: "logout failed" }, { status: 200 });
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("set-cookie", expireCookie);
    return res;
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function DELETE(req: NextRequest) {
  return handle(req);
}
