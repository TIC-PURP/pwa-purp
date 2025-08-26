// app/api/auth/login/route.ts
// Endpoint que realiza el login contra la base de datos CouchDB
import { NextResponse } from "next/server";

// URL del servidor Couch y secreto compartido para el proxy
const COUCH_URL = process.env.COUCH_URL ?? "";
const SECRET    = process.env.COUCH_PROXY_SECRET ?? "";

// (opcional) quita esta línea si tienes runtime edge
// export const runtime = "nodejs";

// Procesa la solicitud POST con las credenciales del usuario
export async function POST(req: Request) {
  if (!COUCH_URL || !SECRET) {
    return new NextResponse("Server misconfigured (env)", { status: 500 });
  }

  const { email, password } = await req.json();

  const body = new URLSearchParams({ name: email, password });
  const r = await fetch(`${COUCH_URL}/_session`, {
    method: "POST",
    headers: {
      "x-proxy-secret": SECRET,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
    redirect: "manual",
  });

  if (r.status === 200) {
    const headers = new Headers();
    const setCookie = r.headers.get("set-cookie");
    if (setCookie) headers.set("set-cookie", setCookie); // opcional
    return new NextResponse(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  // Devuelve el texto de error del servidor Couch
  const txt = await r.text().catch(() => "");
  return new NextResponse(txt || "login failed", { status: r.status });
}
