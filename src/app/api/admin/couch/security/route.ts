import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "";
  return `${proto}://${host}`;
}

async function requireRole(
  req: NextRequest,
  allowedRoles: string[] = ["admin", "manager", "_admin"],
): Promise<{ ok: true; roles: string[]; name: string | null } | { ok: false; res: NextResponse }> {
  try {
    const origin = await getOrigin(req);
    const cookie = req.headers.get("cookie") || "";
    const r = await fetch(`${origin}/api/couch/_session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!r.ok) {
      return {
        ok: false,
        res: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
      };
    }
    const data = await r.json().catch(() => ({} as any));
    const roles: string[] = data?.userCtx?.roles || [];
    const name: string | null = data?.userCtx?.name || null;
    const allowed = new Set(allowedRoles.map(String));
    const hasAccess = roles.some((role) => allowed.has(String(role)));
    if (!hasAccess) {
      return {
        ok: false,
        res: NextResponse.json(
          {
            ok: false,
            error: "Forbidden",
            detail: "missing required role",
            roles,
            user: name,
          },
          { status: 403 },
        ),
      };
    }
    return { ok: true, roles, name };
  } catch (error: any) {
    return {
      ok: false,
      res: NextResponse.json(
        {
          ok: false,
          error: "Auth check failed",
          message: String(error?.message ?? error),
        },
        { status: 500 },
      ),
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

function getCouchHost() {
  const host = process.env.COUCH_HOST || "";
  if (!host) throw new Error("Missing COUCH_HOST env");
  return host.replace(/\/+$/, "");
}

function getCouchDbName() {
  const raw = process.env.NEXT_PUBLIC_COUCHDB_URL || "";
  if (!raw) throw new Error("Missing NEXT_PUBLIC_COUCHDB_URL env");
  const url = new URL(raw);
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const dbName = parts.pop();
  if (!dbName) throw new Error("Unable to derive CouchDB database name from NEXT_PUBLIC_COUCHDB_URL");
  return dbName;
}

function adminHeaders() {
  const auth = getAdminAuthHeader();
  if (!auth) throw new Error("Missing COUCH_ADMIN_USER/COUCH_ADMIN_PASS");
  const headers: Record<string, string> = {
    authorization: auth,
    accept: "application/json",
    "content-type": "application/json",
  };
  const proxySecret = process.env.COUCHDB_PROXY_SECRET;
  if (proxySecret) headers["x-proxy-secret"] = proxySecret;
  return headers;
}

async function fetchSecurity(headers: Record<string, string>, host: string, dbName: string) {
  const res = await fetch(`${host}/${encodeURIComponent(dbName)}/_security`, { headers });
  if (!res.ok) {
    throw new Error(`Unable to load security doc (${res.status})`);
  }
  return (await res.json().catch(() => ({}))) as any;
}

function mergeRoles(existing: any, required: string[]) {
  const roles = new Set<string>();
  if (Array.isArray(existing?.roles)) {
    for (const role of existing.roles) roles.add(String(role));
  }
  for (const role of required) roles.add(String(role));
  return Array.from(roles);
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "manager", "_admin"]);
  if (!auth.ok) return auth.res;
  try {
    const headers = adminHeaders();
    const host = getCouchHost();
    const dbName = getCouchDbName();
    const current = await fetchSecurity(headers, host, dbName);
    return NextResponse.json({ ok: true, security: current });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ["admin", "manager", "_admin"]);
  if (!auth.ok) return auth.res;
  try {
    const headers = adminHeaders();
    const host = getCouchHost();
    const dbName = getCouchDbName();
    const body = (await req.json().catch(() => ({}))) as {
      membersRoles?: string[];
      adminsRoles?: string[];
    };
    const current = await fetchSecurity(headers, host, dbName);
    const defaultMembers = ["admin", "manager", "user"];
    const defaultAdmins = ["_admin", "admin", "manager"];
    const requestedMembers = Array.isArray(body?.membersRoles)
      ? [...body.membersRoles, ...defaultMembers]
      : defaultMembers;
    const members = {
      names: Array.isArray(current?.members?.names) ? current.members.names : [],
      roles: mergeRoles(current?.members, requestedMembers),
    };
    const requestedAdmins = Array.isArray(body?.adminsRoles)
      ? [...body.adminsRoles, ...defaultAdmins]
      : defaultAdmins;
    const admins = {
      names: Array.isArray(current?.admins?.names) ? current.admins.names : [],
      roles: mergeRoles(current?.admins, requestedAdmins),
    };
    const payload = { members, admins };
    const res = await fetch(`${host}/${encodeURIComponent(dbName)}/_security`, {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { ok: false, status: res.status, detail },
        { status: res.status },
      );
    }
    return NextResponse.json({ ok: true, security: payload });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}


