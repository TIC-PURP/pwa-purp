export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

const ROLES = ["manager","admin","user"] as const;
type AppRole = typeof ROLES[number];
const MAP_ROLE = (v: string): AppRole => {
  const x = (v || "").toLowerCase();
  if (["manager","administrador","admin","administrator"].includes(x)) {
    return x.startsWith("man") ? "manager" : "admin";
  }
  return "user";
};

function b64(u: string, p: string) {
  return "Basic " + Buffer.from(`${u}:${p}`).toString("base64");
}
function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable ${name}`);
  return v;
}
async function assertManagerOrAdmin(req: NextRequest) {
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: { email: string } }) {
  try {
    const deny = await assertManagerOrAdmin(req);
    if (deny) return deny;

    const email = decodeURIComponent(params.email).toLowerCase();
    const body = await req.json();
    const maybePassword = body.password as string | undefined;
    const maybeRole: AppRole | undefined = body.role ? MAP_ROLE(body.role) : undefined;

    const host = env("COUCH_HOST");
    const adminU = env("COUCH_ADMIN_USER");
    const adminP = env("COUCH_ADMIN_PASS");

    const userDocId = `org.couchdb.user:${email}`;
    const get = await fetch(`${host}/_users/${encodeURIComponent(userDocId)}`, {
      headers: { Authorization: b64(adminU, adminP) },
      cache: "no-store"
    });
    if (!get.ok) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    const userDoc = await get.json();

    if (maybePassword) (userDoc as any).password = maybePassword;
    if (maybeRole) (userDoc as any).roles = [maybeRole];

    const put = await fetch(`${host}/_users/${encodeURIComponent(userDocId)}`, {
      method: "PUT",
      headers: { Authorization: b64(adminU, adminP), "Content-Type":"application/json" },
      body: JSON.stringify(userDoc)
    });
    if (!put.ok) {
      const t = await put.text();
      return NextResponse.json({ error:"No se pudo actualizar _users", detail:t }, { status: 502 });
    }

    const appUrl = new URL(process.env.NEXT_PUBLIC_COUCHDB_URL!);
    const dbUrl = `${appUrl.origin}${appUrl.pathname.replace(/\/$/,"")}`;
    const find = await fetch(`${dbUrl}/_find`, {
      method: "POST",
      headers: { Authorization: b64(adminU, adminP), "Content-Type":"application/json" },
      body: JSON.stringify({ selector: { type:"user_profile", email }, limit:1 })
    }).then(r => r.json());

    const profile = find?.docs?.[0];
    if (profile) {
      if (typeof body.name === "string") profile.name = body.name;
      if (typeof body.isActive === "boolean") profile.isActive = body.isActive;
      if (maybeRole) profile.role = maybeRole;
      profile.updatedAt = new Date().toISOString();

      const save = await fetch(`${dbUrl}/${profile._id}`, {
        method: "PUT",
        headers: { Authorization: b64(adminU, adminP), "Content-Type":"application/json" },
        body: JSON.stringify(profile)
      });
      if (!save.ok) {
        const t = await save.text();
        return NextResponse.json({ error:"No se pudo actualizar perfil", detail:t }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { email: string } }) {
  try {
    const deny = await assertManagerOrAdmin(req);
    if (deny) return deny;

    const email = decodeURIComponent(params.email).toLowerCase();
    const host = env("COUCH_HOST");
    const adminU = env("COUCH_ADMIN_USER");
    const adminP = env("COUCH_ADMIN_PASS");

    const id = `org.couchdb.user:${email}`;
    const get = await fetch(`${host}/_users/${encodeURIComponent(id)}`, {
      headers: { Authorization: b64(adminU, adminP) },
      cache: "no-store"
    });
    if (get.ok) {
      const doc = await get.json();
      await fetch(`${host}/_users/${encodeURIComponent(id)}?rev=${encodeURIComponent(doc._rev)}`, {
        method: "DELETE",
        headers: { Authorization: b64(adminU, adminP) }
      }).catch(()=>{});
    }

    const appUrl = new URL(process.env.NEXT_PUBLIC_COUCHDB_URL!);
    const dbUrl = `${appUrl.origin}${appUrl.pathname.replace(/\/$/,"")}`;
    const find = await fetch(`${dbUrl}/_find`, {
      method: "POST",
      headers: { Authorization: b64(adminU, adminP), "Content-Type":"application/json" },
      body: JSON.stringify({ selector: { type:"user_profile", email }, limit:1 })
    }).then(r => r.json());
    const profile = find?.docs?.[0];
    if (profile) {
      profile.isActive = false;
      profile.updatedAt = new Date().toISOString();
      await fetch(`${dbUrl}/${profile._id}`, {
        method: "PUT",
        headers: { Authorization: b64(adminU, adminP), "Content-Type":"application/json" },
        body: JSON.stringify(profile)
      }).catch(()=>{});
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}
