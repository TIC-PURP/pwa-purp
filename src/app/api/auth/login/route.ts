// src/app/api/auth/login/route.ts
import { NextResponse } from "next/server";

const COUCHDB_URL = process.env.COUCHDB_URL;
const COUCHDB_PROXY_SECRET = process.env.COUCHDB_PROXY_SECRET;

export async function POST(req: Request) {
  try {
    if (!COUCHDB_URL || !COUCHDB_PROXY_SECRET) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    // soporta JSON o form-data desde el cliente
    let email = "";
    let password = "";

    const ct = req.headers.get("content-type") || "";
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
      return NextResponse.json(
        { error: "email/password required" },
        { status: 400 }
      );
    }

    // CouchDB _session requiere application/x-www-form-urlencoded
    const body = new URLSearchParams({
      name: email,
      password,
    });

    const couchRes = await fetch(`${COUCHDB_URL}/_session`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-proxy-secret": COUCHDB_PROXY_SECRET,
      },
      body,
      // no seguimos redirecciones; solo nos interesa el status y el JSON
      redirect: "manual",
    });

    // Couch devuelve JSON con ok/name/roles o error/unauthorized
    const data = await couchRes
      .json()
      .catch(() => ({ error: "invalid json from couch" }));

    if (!couchRes.ok) {
      // pasa el motivo al cliente para depurar
      return NextResponse.json(
        { error: data?.reason || "login failed" },
        { status: couchRes.status }
      );
    }

    // Nota: el Set-Cookie de CouchDB es para el dominio del proxy (35-…sslip.io),
    // el navegador en localhost no puede usar esa cookie. La app debe consumir
    // Couch exclusivamente vía endpoints del servidor (no directo desde el cliente).
    return NextResponse.json({
      ok: true,
      user: data?.name,
      roles: data?.roles || [],
    });
  } catch (err) {
    console.error("[login] unexpected", err);
    return NextResponse.json({ error: "unexpected error" }, { status: 500 });
  }
}
