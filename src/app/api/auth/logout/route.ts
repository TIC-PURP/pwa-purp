import { NextRequest, NextResponse } from "next/server";

async function handle(req: NextRequest) {
  try {
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host") || "";
    const origin = `${proto}://${host}`;
    const cookie = req.headers.get("cookie") || "";
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
    const status = couchRes.ok ? 200 : couchRes.status || 500;
    const res = NextResponse.json({ ok: couchRes.ok, data }, { status });
    if (setCookie) res.headers.set("set-cookie", setCookie);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("[auth/logout] unexpected", (error as any)?.message || error);
    return NextResponse.json({ ok: false, error: "logout failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function DELETE(req: NextRequest) {
  return handle(req);
}
