import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const base = process.env.COUCH_HOST;
    if (!base) {
      console.error("[api/auth/login] missing COUCH_HOST");
      return NextResponse.json({ ok:false, error:"Missing COUCH_HOST" }, { status:500 });
    }

    // 1) Leer body como JSON o form-urlencoded y convertir SIEMPRE a x-www-form-urlencoded para CouchDB
    const ct = req.headers.get("content-type") || "";
    let name = "", password = "";
    if (ct.includes("application/json")) {
      const j = await req.json().catch(() => ({}));
      name = j?.name || j?.username || "";
      password = j?.password || "";
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const txt = await req.text();
      const p = new URLSearchParams(txt);
      name = p.get("name") || p.get("username") || "";
      password = p.get("password") || "";
    } else {
      // fallback: intenta ambas
      const txt = await req.text();
      try {
        const j = JSON.parse(txt);
        name = j?.name || j?.username || "";
        password = j?.password || "";
      } catch {
        const p = new URLSearchParams(txt);
        name = p.get("name") || p.get("username") || "";
        password = p.get("password") || "";
      }
    }
    const bodyText = new URLSearchParams({ name, password }).toString();
    console.log("[api/auth/login] attempting", name);

    // 2) POST /_session (server->CouchDB)
    const loginRes = await fetch(`${base}/_session`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: bodyText,
      redirect: "manual",
    });
    console.log("[api/auth/login] _session POST", loginRes.status);

    // 3) Normaliza Set-Cookie (quita Domain y fuerza Path=/)
    let setCookie = loginRes.headers.get("set-cookie") ?? undefined;
    if (setCookie) {
      setCookie = setCookie
        .replace(/Domain=[^;]+;?\s*/i, "")
        .replace(/Path=[^;]+;?\s*/i, "Path=/; ");
    }
    const loginJson = await loginRes.json().catch(() => ({} as any));

    // 4) GET /_session con la cookie (server->CouchDB) para devolver estado
    const sessionRes = await fetch(`${base}/_session`, {
      method: "GET",
      headers: setCookie ? { cookie: setCookie } : undefined,
    });
    console.log("[api/auth/login] _session GET", sessionRes.status);
    const sessionJson = await sessionRes.json().catch(() => ({} as any));
    console.log("[api/auth/login] sessionJson", sessionJson);

    // 5) Responder al navegador y **propagar** el Set-Cookie
    const resp = NextResponse.json(
      { ok: loginRes.ok && sessionRes.ok, login: loginJson, session: sessionJson },
      { status: loginRes.ok ? 200 : loginRes.status }
    );
    if (setCookie) resp.headers.set("set-cookie", setCookie);
    resp.headers.set("Cache-Control", "no-store");
    return resp;
  } catch (e:any) {
    console.error("[api/auth/login] error", e);
    return NextResponse.json({ ok:false, error:"auth-login-failed", message: String(e?.message ?? e) }, { status:500 });
  }
}
