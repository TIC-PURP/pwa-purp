// === /app/api/admin/couch/files/route.ts ===
// Endpoint admin para crear/actualizar (PUT), obtener (GET) y eliminar (DELETE)
// documentos de tipo archivo en CouchDB usando credenciales admin.

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
  const direct = process.env.COUCHDB_DB_FILES || process.env.COUCHDB_DB;
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

function couchAllDocsUrl(id: string, opts: { includeDocs?: boolean; includeConflicts?: boolean } = {}) {
  const base = `${getCouchHost()}/${encodeURIComponent(getCouchDbName())}/_all_docs`;
  const params = new URLSearchParams();
  params.set("key", JSON.stringify(id));
  if (opts.includeDocs) params.set("include_docs", "true");
  if (opts.includeConflicts) params.set("conflicts", "true");
  params.set("limit", "1");
  return `${base}?${params.toString()}`;
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
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

export type AdminFilePutPayload = {
  doc: Record<string, any> & { _id: string; _rev?: string };
  attachments?: {
    [name: string]: { content_type: string; data: string };
  };
  forceAttachments?: boolean;
};

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as AdminFilePutPayload;
    if (!body?.doc || !body.doc._id) {
      return new Response(JSON.stringify({ error: "doc con _id es requerido" }), { status: 400 });
    }

    const payload = { ...body.doc } as any;
    if (body.attachments && (body.forceAttachments || !payload._attachments)) {
      payload._attachments = body.attachments;
    }

    console.log("[admin/files] PUT", {
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
    console.log("[admin/files] PUT respuesta", res.status, data);
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
    const includeDeleted = parseBooleanParam(searchParams.get("includeDeleted"));
    const includeConflicts = parseBooleanParam(searchParams.get("includeConflicts"));
    if (!id) {
      return new Response(JSON.stringify({ error: "id query param requerido" }), { status: 400 });
    }
    console.log("[admin/files] GET", { id, target: couchDocUrl(id) });
    const headers = buildHeaders();
    const res = await fetch(couchDocUrl(id), { headers });
    const data = await res.json().catch(() => ({}));
    console.log("[admin/files] GET respuesta", res.status, data);
    if (res.ok) {
      return new Response(JSON.stringify({ ok: true, doc: data }), { status: 200 });
    }
    if (res.status === 404 && includeDeleted) {
      try {
        const metaUrl = couchAllDocsUrl(id, { includeDocs: true, includeConflicts });
        const metaRes = await fetch(metaUrl, { headers });
        const meta = await metaRes.json().catch(() => ({}));
        console.log("[admin/files] GET fallback _all_docs", metaRes.status, meta);
        if (metaRes.ok && Array.isArray(meta?.rows) && meta.rows.length > 0) {
          const row = meta.rows[0] || {};
          const doc = row.doc || null;
          const value = row.value || null;
          const rev = (doc && doc._rev) || (value && value.rev) || null;
          const deleted = Boolean(value?.deleted || doc?._deleted);
          return new Response(JSON.stringify({ ok: true, doc, value, rev, deleted }), { status: 200 });
        }
        return new Response(
          JSON.stringify({ error: "couch_get_failed", status: metaRes.status, data: meta }),
          { status: metaRes.status || 404 },
        );
      } catch (metaError: any) {
        return new Response(
          JSON.stringify({ error: "meta_lookup_failed", message: metaError?.message || String(metaError) }),
          { status: 500 },
        );
      }
    }
    return new Response(JSON.stringify({ error: "couch_get_failed", status: res.status, data }), { status: res.status });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unknown" }), { status: 500 });
  }
}

export type AdminFileDeletePayload = {
  _id: string;
  _rev?: string;
};

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as AdminFileDeletePayload;
    if (!body?._id) {
      return new Response(JSON.stringify({ error: "_id requerido" }), { status: 400 });
    }

    console.log("[admin/files] DELETE", { id: body._id, suppliedRev: body._rev });

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
    console.log("[admin/files] DELETE respuesta", del.status, data);
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
