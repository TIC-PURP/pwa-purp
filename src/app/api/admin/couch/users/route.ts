// Admin API to manage CouchDB /_users documents from the PWA
// - Authorizes caller by checking current CouchDB session roles (admin/manager)
// - Performs Basic-auth requests to COUCH_HOST/_users with server-side admin creds

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UpsertBody = {
  name?: string; // username (we use email as name)
  email?: string; // optional alias; if present and name is missing, use email
  password?: string;
  roles?: string[]; // couch roles
};

async function getOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "";
  return `${proto}://${host}`;
}

async function requireRole(req: NextRequest): Promise<
  | { ok: true; roles: string[]; name: string | null }
  | { ok: false; res: NextResponse }
> {
  try {
    const origin = await getOrigin(req);
    const cookie = req.headers.get("cookie") || "";
    const r = await fetch(`${origin}/api/couch/_session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!r.ok) {
      return { ok: false, res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
    }
    const data = await r.json().catch(() => ({} as any));
    const roles: string[] = data?.userCtx?.roles || [];
    const name: string | null = data?.userCtx?.name || null;
    // Allow admin, _admin (server admin), or manager
    const allowed = new Set(["admin", "manager", "_admin"]);
    const hasAccess = roles.some((r: string) => allowed.has(String(r)));
    if (!hasAccess) {
      return {
        ok: false,
        res: NextResponse.json(
          { ok: false, error: "Forbidden", detail: "missing required role", roles, user: name },
          { status: 403 },
        ),
      };
    }
    return { ok: true, roles, name };
  } catch (e: any) {
    return {
      ok: false,
      res: NextResponse.json({ ok: false, error: "Auth check failed", message: String(e?.message ?? e) }, { status: 500 }),
    };
  }
}

function getAdminAuthHeader() {
  const user = process.env.COUCH_ADMIN_USER || "";
  const pass = process.env.COUCH_ADMIN_PASS || "";
  if (!user || !pass) return null;
  const token = Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

function getUsersUrlBase() {
  const host = process.env.COUCH_HOST;
  if (!host) throw new Error("Missing COUCH_HOST env");
  return `${host.replace(/\/$/, "")}/_users`;
}

function toUserId(name: string) {
  return `org.couchdb.user:${name}`;
}

async function adminFetch(path: string, init: RequestInit & { method: string }) {
  const auth = getAdminAuthHeader();
  if (!auth) {
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Missing admin credentials (COUCH_ADMIN_USER/COUCH_ADMIN_PASS)" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
  const url = `${getUsersUrlBase()}${path}`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: auth,
    accept: "application/json",
  };
  // Pass through proxy secret if configured (required by your nginx/Couch proxy)
  const proxySecret = process.env.COUCHDB_PROXY_SECRET;
  if (proxySecret) headers["x-proxy-secret"] = proxySecret;
  if (init.headers) Object.assign(headers, init.headers as any);
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  const ct = res.headers.get("content-type") || "";
  const body = ct.includes("json") ? (text ? JSON.parse(text) : {}) : { raw: text };
  return new NextResponse(JSON.stringify(body), { status: res.status, headers: { "content-type": "application/json" } });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as UpsertBody;
  const name = (body.name || body.email || "").trim();
  const password = (body.password || "").trim();
  const roles = Array.isArray(body.roles) ? body.roles.filter(Boolean) : [];
  if (!name || !password) {
    return NextResponse.json({ ok: false, error: "name/email and password required" }, { status: 400 });
  }
  const doc = {
    _id: toUserId(name),
    name,
    type: "user",
    roles,
    password,
  };
  // CouchDB creates with PUT to specific id
  return adminFetch(`/${encodeURIComponent(doc._id)}`, { method: "PUT", body: JSON.stringify(doc) });
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.ok) return auth.res;
  const body = (await req.json().catch(() => ({}))) as UpsertBody & { name: string };
  const name = (body.name || body.email || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name/email required" }, { status: 400 });
  const password = (body.password || "").trim();
  const roles = Array.isArray(body.roles) ? body.roles.filter(Boolean) : undefined;

  // Load existing to get _rev
  const getRes = await adminFetch(`/${encodeURIComponent(toUserId(name))}`, { method: "GET" });
  if (!getRes.ok) return getRes;
  const existing = (await getRes.json().catch(() => ({}))) as any;
  if (!existing || !existing._id) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const patch: any = { ...existing };
  if (roles) patch.roles = roles;
  if (password) patch.password = password; // CouchDB will hash it

  return adminFetch(`/${encodeURIComponent(patch._id)}`, { method: "PUT", body: JSON.stringify(patch) });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.ok) return auth.res;
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") || searchParams.get("email") || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name/email required" }, { status: 400 });
  // Load existing to get rev
  const getRes = await adminFetch(`/${encodeURIComponent(toUserId(name))}`, { method: "GET" });
  if (!getRes.ok) return getRes;
  const existing = (await getRes.json().catch(() => ({}))) as any;
  if (!existing || !existing._id || !existing._rev) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return adminFetch(`/${encodeURIComponent(existing._id)}?rev=${encodeURIComponent(existing._rev)}`, { method: "DELETE" });
}

// List or fetch auth users from CouchDB /_users (admin/manager only)
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") || searchParams.get("email") || "").trim();

  // Helper to normalize the response for the client without sensitive fields
  const toSafe = (doc: any) => ({
    id: doc?._id,
    name: doc?.name || "",
    roles: Array.isArray(doc?.roles) ? doc.roles : [],
    type: doc?.type || "",
  });

  if (name) {
    const res = await adminFetch(`/${encodeURIComponent(toUserId(name))}`, { method: "GET" });
    if (!res.ok) return res;
    const doc = await res.json().catch(() => ({}));
    if (!doc || !(doc as any)._id) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, user: toSafe(doc) });
  }

  // List all org.couchdb.user:* docs
  const startKey = encodeURIComponent('"org.couchdb.user:"');
  const endKey = encodeURIComponent('"org.couchdb.user:\ufff0"');
  const qs = `?include_docs=true&startkey=${startKey}&endkey=${endKey}`;
  const listRes = await adminFetch(`/_all_docs${qs}`, { method: "GET" });
  if (!listRes.ok) return listRes;
  const data = (await listRes.json().catch(() => ({}))) as any;
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const users = rows
    .map((r: any) => r?.doc)
    .filter((d: any) => d && d.type === "user")
    .map(toSafe);
  return NextResponse.json({ ok: true, users });
}
