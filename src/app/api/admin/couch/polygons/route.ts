// === /app/api/admin/couch/polygons/route.ts ===
// Endpoint admin para gestionar documentos de polígonos (coordenadas + preview)
// en CouchDB usando credenciales privilegiadas.

import type { NextRequest } from "next/server";

function getAdminAuthHeader(): string {
  const user = process.env.COUCHDB_ADMIN_USER || process.env.COUCH_ADMIN_USER || "";
  const pass = process.env.COUCHDB_ADMIN_PASS || process.env.COUCH_ADMIN_PASS || "";
  if (!user || !pass) {
    throw new Error("Missing COUCHDB_ADMIN_USER/COUCHDB_ADMIN_PASS env vars");
  }
  const token = Buffer.from(`${user}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

function getCouchHost(): string {
  const host = process.env.COUCH_HOST || process.env.COUCHDB_URL || "";
  if (!host) {
    throw new Error("Missing COUCH_HOST env var");
  }
  return host.replace(/\/+$/, "");
}

function getCouchDbName(): string {
  const direct = process.env.COUCHDB_DB_POLYGONS || process.env.COUCHDB_DB;
  if (direct && direct.trim()) return direct.trim();
  const raw = process.env.NEXT_PUBLIC_COUCHDB_URL || "";
  if (!raw) throw new Error("Unable to resolve CouchDB DB name (NEXT_PUBLIC_COUCHDB_URL not set)");
  const url = new URL(raw);
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const dbName = parts.pop();
  if (!dbName) throw new Error("Unable to derive CouchDB DB name from NEXT_PUBLIC_COUCHDB_URL");
  return dbName;
}

function couchDocUrl(id?: string, rev?: string) {
  const base = `${getCouchHost()}/${encodeURIComponent(getCouchDbName())}`;
  if (!id) return base;
  const qs = rev ? `?rev=${encodeURIComponent(rev)}` : "";
  return `${base}/${encodeURIComponent(id)}${qs}`;
}

function buildHeaders(extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    Authorization: getAdminAuthHeader(),
    Accept: "application/json",
    ...extra,
  };
  const proxySecret = process.env.COUCHDB_PROXY_SECRET;
  if (proxySecret) headers["x-proxy-secret"] = proxySecret;
  return headers;
}

export type AdminPolygonPutPayload = {
  doc: Record<string, any> & { _id: string; _rev?: string };
  attachments?: {
    [name: string]: { content_type: string; data: string };
  };
  forceAttachments?: boolean;
};

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as AdminPolygonPutPayload;
    if (!body?.doc || !body.doc._id) {
      return new Response(JSON.stringify({ error: "doc con _id es requerido" }), { status: 400 });
    }

    const payload = { ...body.doc } as any;
    if (body.attachments && (body.forceAttachments || !payload._attachments)) {
      payload._attachments = body.attachments;
    }

    console.log("[admin/polygons] PUT", {
      id: payload._id,
      hasAttachments: !!payload._attachments,
      attachmentNames: Object.keys(payload._attachments || {}),
      rev: payload._rev,
      target: couchDocUrl(payload._id),
    });

    const res = await fetch(couchDocUrl(payload._id), {
      method: "PUT",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    console.log("[admin/polygons] PUT respuesta", res.status, data);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "couch_put_failed", status: res.status, data }), {
        status: 502,
      });
    }
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "id query param requerido" }), { status: 400 });
    }
    console.log("[admin/polygons] GET", { id, target: couchDocUrl(id) });
    const res = await fetch(couchDocUrl(id), { headers: buildHeaders() });
    const data = await res.json().catch(() => ({}));
    console.log("[admin/polygons] GET respuesta", res.status, data);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "couch_get_failed", status: res.status, data }), { status: res.status });
    }
    return new Response(JSON.stringify({ ok: true, doc: data }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), { status: 500 });
  }
}

export type AdminPolygonDeletePayload = {
  _id: string;
  _rev?: string;
};

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as AdminPolygonDeletePayload;
    if (!body?._id) {
      return new Response(JSON.stringify({ error: "_id requerido" }), { status: 400 });
    }

    console.log("[admin/polygons] DELETE", { id: body._id, suppliedRev: body._rev });

    let rev = body._rev;
    if (!rev) {
      const head = await fetch(couchDocUrl(body._id), { method: "HEAD", headers: buildHeaders() });
      if (head.ok) {
        rev = head.headers.get("ETag")?.replaceAll('"', "") || undefined;
      }
      if (!rev) {
        const getRes = await fetch(couchDocUrl(body._id), { headers: buildHeaders() });
        if (getRes.ok) {
          const doc = await getRes.json();
          rev = doc._rev;
        }
      }
    }

    if (!rev) {
      return new Response(JSON.stringify({ error: "no_rev_found" }), { status: 404 });
    }

    const del = await fetch(couchDocUrl(body._id, rev), { method: "DELETE", headers: buildHeaders() });
    const data = await del.json().catch(() => ({}));
    console.log("[admin/polygons] DELETE respuesta", del.status, data);
    if (!del.ok) {
      return new Response(JSON.stringify({ error: "couch_delete_failed", status: del.status, data }), {
        status: 502,
      });
    }

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), { status: 500 });
  }
}

