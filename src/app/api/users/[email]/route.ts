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

// DELETE /api/users/[email] -> elimina usuario de _users
export async function DELETE(_req: NextRequest, { params }: { params: { email: string } }) {
  try {
    const host = envOrError("COUCH_HOST");
    const adminUser = envOrError("COUCH_ADMIN_USER");
    const adminPass = envOrError("COUCH_ADMIN_PASS");
    const id = `org.couchdb.user:${params.email}`;

    const get = await fetch(`${host}/_users/${encodeURIComponent(id)}`, {
      headers: { Authorization: basicAuth(adminUser, adminPass) },
      cache: "no-store"
    });
    if (!get.ok) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    const doc = await get.json();

    const del = await fetch(`${host}/_users/${encodeURIComponent(id)}?rev=${doc._rev}`, {
      method: "DELETE",
      headers: { Authorization: basicAuth(adminUser, adminPass) }
    });
    const data = await del.json();
    return NextResponse.json(data, { status: del.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}
