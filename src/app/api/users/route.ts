export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function basicAuth(user: string, pass: string) {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}
function envOrError(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable ${name}`);
  return v;
}

// GET /api/users -> ping
export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST para crear usuario" });
}

// POST /api/users -> crea usuario en _users (JSON o x-www-form-urlencoded)
export async function POST(req: NextRequest) {
  try {
    const host = envOrError("COUCH_HOST");
    const adminUser = envOrError("COUCH_ADMIN_USER");
    const adminPass = envOrError("COUCH_ADMIN_PASS");

    const ct = req.headers.get("content-type") || "";
    let email: string | null = null;
    let password: string | null = null;
    let roles: string[] = ["app_user"];

    if (ct.includes("application/json")) {
      const body = await req.json();
      email = body.email ?? body.name ?? null;
      password = body.password ?? null;
      if (Array.isArray(body.roles) && body.roles.length) roles = body.roles;
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      email = (form.get("email") || form.get("name")) as string | null;
      password = (form.get("password") as string) || null;
      const r = form.get("roles");
      if (typeof r === "string") {
        try { roles = JSON.parse(r); } catch {}
      }
    } else {
      return NextResponse.json({ error: "Usa JSON o x-www-form-urlencoded" }, { status: 415 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: "email (o name) y password son requeridos" }, { status: 400 });
    }

    const body = {
      _id: `org.couchdb.user:${email}`,
      name: email,
      type: "user",
      roles,
      password
    };

    const resp = await fetch(`${host}/_users`, {
      method: "POST",
      headers: {
        Authorization: basicAuth(adminUser, adminPass),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}
