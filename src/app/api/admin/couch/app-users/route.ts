import { NextRequest, NextResponse } from "next/server";

function getAdminAuthHeader(): string | null {
  const user = process.env.COUCH_ADMIN_USER || "";
  const pass = process.env.COUCH_ADMIN_PASS || "";
  if (!user || !pass) return null;
  const token = Buffer.from(`${user}:${pass}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

/**
 * Determina el nombre de la base de datos de CouchDB a partir de la URL pública
 * o de la variable de entorno COUCHDB_DB.
 *
 * Cuando NEXT_PUBLIC_COUCHDB_URL incluye el nombre de la base como último
 * segmento del path (por ejemplo "https://host/dbname"), lo devuelve. Si
 * no hay ningún segmento (por ejemplo cuando es la raíz del host), usa el
 * valor de COUCHDB_DB.  Si no se puede determinar, lanza un error.
 */
function getCouchDbName(): string {
  const envDb = (process.env.COUCHDB_DB || "").trim();
  const raw = (process.env.NEXT_PUBLIC_COUCHDB_URL || "").trim();
  if (raw) {
    try {
      const url = new URL(raw);
      const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
      const dbCandidate = parts.pop();
      // Si el último segmento no comienza con "_" lo consideramos nombre de DB
      if (dbCandidate && !dbCandidate.startsWith("_")) {
        return dbCandidate;
      }
    } catch {
      // Ignorar errores de URL y continuar con envDb
    }
  }
  if (envDb) {
    return envDb;
  }
  throw new Error("Unable to derive CouchDB database name from NEXT_PUBLIC_COUCHDB_URL or COUCHDB_DB");
}

function getCouchHost(): string {
  const host = process.env.COUCH_HOST || "";
  if (!host) {
    throw new Error("Missing COUCH_HOST env");
  }
  return host.replace(/\/+$/, "");
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const doc = body?.doc;
    if (!doc || typeof doc !== "object" || !doc._id) {
      return NextResponse.json({ ok: false, error: "Request must include doc with _id" }, { status: 400 });
    }

    const auth = getAdminAuthHeader();
    if (!auth) {
      return NextResponse.json({ ok: false, error: "Missing COUCH_ADMIN_USER / COUCH_ADMIN_PASS" }, { status: 500 });
    }

    const dbName = getCouchDbName();
    const host = getCouchHost();
    const target = `${host}/${encodeURIComponent(dbName)}/${encodeURIComponent(String(doc._id))}`;

    const headers: Record<string, string> = {
      authorization: auth,
      "content-type": "application/json",
      accept: "application/json",
    };
    const proxySecret = process.env.COUCHDB_PROXY_SECRET;
    if (proxySecret) {
      headers["x-proxy-secret"] = proxySecret;
    }

    const cleanDoc: Record<string, any> = { ...doc };
    delete cleanDoc.___writePath;

    const res = await fetch(target, {
      method: "PUT",
      headers,
      body: JSON.stringify(cleanDoc),
    });

    const text = await res.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, detail: payload }, { status: res.status });
    }

    return NextResponse.json({ ok: true, couch: payload });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) }, { status: 500 });
  }
}
