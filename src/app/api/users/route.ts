export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

const ROLES = ["manager", "admin", "user"] as const;
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
  // En un entorno real deberías validar rol con /_session del cookie actual.
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const deny = await assertManagerOrAdmin(req);
    if (deny) return deny;

    const host = env("COUCH_HOST");
    const adminU = env("COUCH_ADMIN_USER");
    const adminP = env("COUCH_ADMIN_PASS");

    const body = await req.json();
    const email: string = (body.email || body.name || "").trim().toLowerCase();
    const password: string = String(body.password || "");
    const role: AppRole = MAP_ROLE(body.role);

    if (!email || !password) {
      return NextResponse.json({ error: "email y password son obligatorios" }, { status: 400 });
    }

    // 1) Upsert /_users
    const userDocId = `org.couchdb.user:${email}`;
    const get = await fetch(`${host}/_users/${encodeURIComponent(userDocId)}`, {
      headers: { Authorization: b64(adminU, adminP) },
      cache: "no-store"
    });
    const existing = get.ok ? await get.json() : null;

    const userDoc = {
      ...(existing ?? { _id: userDocId, type: "user", name: email }),
      roles: [role],
      password,
    };

    const upsert = await fetch(`${host}/_users/${encodeURIComponent(userDocId)}`, {
      method: "PUT",
      headers: {
        Authorization: b64(adminU, adminP),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userDoc),
    });
    if (!upsert.ok) {
      const e = await upsert.text();
      return NextResponse.json({ error: "No se pudo guardar en _users", detail: e }, { status: 502 });
    }

    // 2) Upsert perfil remoto (DB app)
    const appUrl = new URL(process.env.NEXT_PUBLIC_COUCHDB_URL!);
    const dbUrl = `${appUrl.origin}${appUrl.pathname.replace(/\/$/,"")}`;

    // find profile
    const find = await fetch(`${dbUrl}/_find`, {
      method: "POST",
      headers: {
        Authorization: b64(adminU, adminP),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        selector: { type: "user_profile", email },
        limit: 1
      })
    }).then(r => r.json());

    const now = new Date().toISOString();
    let profile: any = find?.docs?.[0] ?? {
      type: "user_profile",
      email,
      createdAt: now,
    };
    profile.name = body.name || email.split("@")[0];
    profile.role = role;
    profile.isActive = body.isActive !== false;
    profile.updatedAt = now;

    const saveProfile = await fetch(`${dbUrl}/${profile._id || ""}`, {
      method: profile._id ? "PUT" : "POST",
      headers: {
        Authorization: b64(adminU, adminP),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profile)
    });
    const profRes = await saveProfile.json();

    return NextResponse.json({ ok: true, user: { email, role }, profile: profRes });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error" }, { status: 500 });
  }
}
