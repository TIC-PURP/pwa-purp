// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";

// Esta ruta hace login contra CouchDB (_session) a través del proxy local
// y reenvía el Set-Cookie al navegador para que PouchDB pueda autenticarse
// en /api/couch. No se elimina el flag Secure (queda comentado por si se
// requiere en entornos HTTP de desarrollo).

export async function POST(req: Request) {
  try {
    // Soporta JSON o form-data
    const ct = req.headers.get("content-type") || "";
    let email = "";
    let password = "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      email = (body.email || body.username || "").trim();
      password = (body.password || "").trim();
    } else {
      const form = await req.formData();
      email = String(form.get("email") || form.get("username") || "").trim();
      password = String(form.get("password") || "").trim();
    }

    if (!email || !password) {
      return NextResponse.json({ error: "email/password required" }, { status: 400 });
    }

    // Body para CouchDB _session (x-www-form-urlencoded)
    const sessionBody = new URLSearchParams({ name: email, password });

    // Llamada al PROXY local para que el Set-Cookie sea del mismo origen
    const origin = `${req.headers.get("x-forwarded-proto") || "http"}://${req.headers.get("host")}`;
    const proxyUrl = `${origin}/api/couch/_session`;
    const couchRes = await fetch(proxyUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: sessionBody,
      redirect: "manual",
    });

    // Respuesta de Couch
    const data = await couchRes.json().catch(() => ({} as any));
    if (!couchRes.ok || (data as any)?.error) {
      return NextResponse.json(
        { error: (data as any)?.reason || (data as any)?.error || "login failed" },
        { status: couchRes.status || 401 },
      );
    }

    // Reenviar Set-Cookie al cliente; en localhost/http quitamos Secure para que el navegador la acepte.
    let setCookie = couchRes.headers.get("set-cookie") || "";
    if (setCookie) {
      setCookie = setCookie.replace(/;\s*Domain=[^;]*/i, "");
      const isLocal = (req.headers.get("x-forwarded-proto") || "http") === "http" &&
        /^(localhost|127\.0\.0\.1)(:|$)/.test(String(req.headers.get("host") || ""));
      if (isLocal) {
        setCookie = setCookie.replace(/;\s*Secure/gi, "");
      }
      if (!/;\s*Path=/i.test(setCookie)) setCookie += "; Path=/";
      if (!/;\s*SameSite=/i.test(setCookie)) setCookie += "; SameSite=Lax";
    }

    const res = NextResponse.json({ ok: true, user: (data as any)?.name, roles: (data as any)?.roles || [] });
    if (setCookie) res.headers.set("set-cookie", setCookie);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("[login] unexpected", err);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
