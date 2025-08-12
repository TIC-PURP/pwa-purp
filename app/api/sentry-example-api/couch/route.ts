import { NextResponse } from "next/server";
import { couchFetch } from "../couch/_utils";

export async function POST(req: Request) {
  try {
    const { email, password, role = "app_user" } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "email y password son requeridos" },
        { status: 400 }
      );
    }

    const id = `org.couchdb.user:${email}`;
    const doc = {
      _id: id,
      name: email,
      type: "user",
      roles: [role],
      email,
      isActive: true,
      password, // Couch genera los hashes
    };

    const put = await couchFetch(`/_users/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(doc),
    });
    const data = await put.json();

    if (!put.ok) {
      return NextResponse.json({ ok: false, ...data }, { status: put.status });
    }
    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
