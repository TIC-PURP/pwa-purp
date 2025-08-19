// src/lib/database.ts
// CouchDB + PouchDB (offline-first) con writes LOCAL-FIRST y login vía /couchdb/_session

const isClient = typeof window !== "undefined";

let PouchDB: any = null;
let localDB: any = null;
let remoteDB: any = null;
let syncHandler: any = null;

export type CouchEnv = {
  serverBase: string;
  dbName: string;
};

/** Lee NEXT_PUBLIC_COUCHDB_URL y devuelve { serverBase, dbName } */
export function getCouchEnv(): CouchEnv {
  const raw = (process.env.NEXT_PUBLIC_COUCHDB_URL || "").trim();
  if (!raw) throw new Error("NEXT_PUBLIC_COUCHDB_URL no está definido");

  const url = new URL(raw);
  const path = url.pathname.replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  const dbName = parts[parts.length - 1] || "gestion_pwa";

  const serverBase = `${url.protocol}//${url.host}`;
  return { serverBase, dbName };
}

/** Cuando corre en el navegador usamos el proxy /couchdb (same-origin con cookie); en SSR va directo */
function getRemoteBase() {
  const { serverBase } = getCouchEnv();
  return isClient ? "/couchdb" : serverBase;
}

/** fetch con timeout (para no colgarnos en login) */
function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  // Reducir el timeout por defecto de las peticiones para evitar que el login
  // se quede colgado cuando el servidor remoto no responde. Antes era 12000 ms.
  ms = 8000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const opts = { ...init, signal: controller.signal };
  return fetch(input, opts).finally(() => clearTimeout(timer));
}

/** Carga PouchDB y plugin find (solo en cliente) */
async function ensurePouch() {
  if (PouchDB) return;
  // Usamos 'pouchdb' para evitar problemas de tipos en build
  const mod = await import("pouchdb");
  const find = (await import("pouchdb-find")).default;
  PouchDB = (mod as any).default || mod;
  PouchDB.plugin(find);
}

/** Helpers de IDs / normalización */
function slug(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-");
}
function toUserDocId(input: string) {
  if (input.includes(":")) return input;           // user:xxx
  if (input.startsWith("user_")) return `user:${slug(input.slice(5))}`;
  return `user:${slug(input)}`;                    // email o username
}
function buildUserDocFromData(data: any) {
  const key = slug(data.email || data.name || data.id || Date.now().toString());
  const _id = `user:${key}`;
  const now = new Date().toISOString();
  return {
    _id,
    id: `user_${key}`,
    type: "user",
    name: data.name || key,
    email: data.email || "",
    password: data.password || "",
    role: data.role || "user",
    permissions: Array.isArray(data.permissions) ? data.permissions : ["read"],
    isActive: data.isActive !== false,
    createdAt: data.createdAt || now,
    updatedAt: now,
    ...data.extra,
  };
}

/** Abre/crea las bases local y remota */
export async function openDatabases() {
  if (!isClient) return;
  await ensurePouch();
  const { dbName } = getCouchEnv();
  const remoteBase = getRemoteBase();

  if (!localDB) {
    localDB = new PouchDB(`${dbName}_local`, { auto_compaction: true });
  }

  if (!remoteDB) {
    const remoteUrl = `${remoteBase}/${encodeURIComponent(dbName)}`;
    // Configure remote PouchDB options.  When explicit username and
    // password environment variables are provided we pass them to PouchDB
    // via the `auth` property so that it sends a Basic Auth header on
    // every request.  Otherwise we fall back to using browser cookies
    // with `credentials: 'include'` to support CouchDB's /_session API.
    const user = process.env.NEXT_PUBLIC_COUCHDB_USER;
    const pass = process.env.NEXT_PUBLIC_COUCHDB_PASS;
    const opts: any = { skip_setup: true };
    if (user && pass) {
      // Use Basic Auth for all requests.  Do not rely on cookies when
      // credentials are provided.
      opts.auth = { username: user, password: pass };
      // Use default fetch without credentials; Basic Auth will be
      // handled by PouchDB.
    } else {
      // Fall back to cookie‑based auth.  When using /_session the
      // browser must include credentials for each request.
      opts.fetch = (url: RequestInfo, opts2: any = {}) => {
        opts2 = opts2 || {};
        opts2.credentials = "include";
        return (window as any).fetch(url as any, opts2);
      };
      opts.ajax = { withCredentials: true };
    }
    remoteDB = new PouchDB(remoteUrl, opts);
  }

  return { localDB, remoteDB };
}

/** Arranca replicación continua (local <-> remote) */
export async function startSync() {
  if (!isClient) return;
  await openDatabases();
  if (!localDB || !remoteDB) return;

  if (syncHandler?.cancel) return syncHandler;

  const opts: any = { live: true, retry: true, heartbeat: 25000, timeout: 55000 };
  syncHandler = localDB.sync(remoteDB, opts);
  syncHandler
    .on("change", (i: any) => console.log("[sync] change", i.direction))
    .on("paused", (e: any) => console.log("[sync] paused", e?.message || "ok"))
    .on("active", () => console.log("[sync] active"))
    .on("error", (e: any) => console.error("[sync] error", e));
  return syncHandler;
}

/** Detiene replicación */
export async function stopSync() {
  if (syncHandler?.cancel) {
    try { await syncHandler.cancel(); } catch {}
  }
  syncHandler = null;
}

/** Login online contra /_session (usa /couchdb en cliente) */
export async function loginOnlineToCouchDB(name: string, password: string) {
  const base = getRemoteBase();
  const body = new URLSearchParams({ name, password }).toString();
  const res = await fetchWithTimeout(`${base}/_session`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  }, 12000);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`/_session ${res.status} ${res.statusText} ${txt}`);
  }
  return true;
}

/** Cierra la sesión del servidor */
export async function logoutOnlineSession() {
  const base = getRemoteBase();
  try {
    await fetch(`${base}/_session`, { method: "DELETE", credentials: "include" });
  } catch {}
}

/** Login offline contra Pouch local */
export async function authenticateUser(identifier: string, password: string) {
  await openDatabases();
  if (!localDB) return null;

  const candidates = [
    `user_${identifier}`,
    identifier.includes("@") ? `user_${identifier.split("@")[0]}` : null,
  ].filter(Boolean) as string[];

  try {
    await localDB.createIndex({ index: { fields: ["id"] }, name: "idx-id" });
  } catch {}
  for (const cand of candidates) {
    const r = await localDB.find({ selector: { id: cand } });
    if (r.docs?.[0] && r.docs[0].password === password) return r.docs[0];
  }
  return null;
}

/** Guarda/actualiza usuario en Pouch local */
export async function guardarUsuarioOffline(user: any) {
  await openDatabases();
  if (!localDB) throw new Error("localDB no inicializado");

  const key = slug(user.email || user.name || user.id || "");
  const _id = `user:${key}`;
  const toSave = {
    ...buildUserDocFromData(user),
    _id,
    id: `user_${key}`,
    updatedAt: new Date().toISOString(),
  };

  try {
    const existing = await localDB.get(_id);
    toSave._rev = existing._rev;
    await localDB.put(toSave);
  } catch (err: any) {
    if (err?.status === 404) {
      await localDB.put(toSave);
    } else {
      console.error("guardarUsuarioOffline", err);
      throw err;
    }
  }
}

/** Semilla local para primer arranque offline */
export async function initializeDefaultUsers() {
  await openDatabases();
  if (!localDB) return;
  const now = new Date().toISOString();
  // Crear múltiples usuarios por defecto si no existen todavía.  Esto permite iniciar
  // sesión offline con distintos roles/credenciales sin necesidad de crear cuentas manualmente.
  const defaultUsers = [
    {
      name: "Mario Acosta",
      email: "mario_acosta@purp.com.mx",
      password: "Purp_*2023@",
      role: "manager",
      permissions: ["read", "write", "delete", "manage_users"],
    },
    {
      name: "Manager",
      email: "manager@purp.com.mx",
      password: "Purp2023@",
      role: "manager",
      permissions: ["read", "write", "delete", "manage_users"],
    },
  ];
  for (const user of defaultUsers) {
    const doc = buildUserDocFromData({
      ...user,
      createdAt: now,
    });
    try {
      await localDB.get(doc._id);
    } catch (e: any) {
      if (e?.status === 404) await localDB.put(doc);
    }
  }
}

/* ============================
   ==========  USERS  =========
   ============================ */

/** Índices para consultas */
async function ensureUserIndexes() {
  await openDatabases();
  if (!localDB) return;
  try {
    await localDB.createIndex({
      index: { fields: ["type", "updatedAt"] },
      name: "idx-type-updatedAt",
    });
  } catch {}
  try {
    await localDB.createIndex({
      index: { fields: ["email"] },
      name: "idx-email",
    });
  } catch {}
}

/** Lista usuarios (activos por defecto) */
export async function getAllUsers(opts?: { includeInactive?: boolean; limit?: number; }) {
  await openDatabases();
  await ensureUserIndexes();
  const includeInactive = Boolean(opts?.includeInactive);
  const limit = opts?.limit ?? 1000;

  try {
    const selector: any = { type: "user" };
    if (!includeInactive) selector.isActive = { $ne: false };
    const r = await localDB.find({
      selector,
      sort: [{ updatedAt: "desc" }],
      limit,
    });
    return r.docs || [];
  } catch {
    const resA = await localDB.allDocs({
      include_docs: true,
      startkey: "user:",
      endkey: "user;\ufff0",
      limit,
    });
    const resB = await localDB.allDocs({
      include_docs: true,
      startkey: "user_",
      endkey: "user_\ufff0",
      limit,
    });
    const docs = [...resA.rows, ...resB.rows]
      .map((r: any) => r.doc)
      .filter(Boolean)
      .filter((d: any) =>
        includeInactive ? d.type === "user" : d.type === "user" && d.isActive !== false,
      );
    docs.sort((a: any, b: any) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
    );
    return docs;
  }
}

/** Crea (o upserta) usuario — LOCAL FIRST */
export async function createUser(data: any) {
  await openDatabases();
  const doc = buildUserDocFromData(data);
  try {
    const existing = await localDB.get(doc._id);
    doc._rev = existing._rev;
    doc.createdAt = existing.createdAt || doc.createdAt;
  } catch {}
  await localDB.put(doc); // << LOCAL ONLY. La replicación lo sube.
  return doc;
}

/** Get por id/email/username */
export async function getUserById(idOrKey: string) {
  await openDatabases();
  const _id = toUserDocId(idOrKey);
  try {
    return await localDB.get(_id);
  } catch (e: any) {
    if (e?.status === 404) return null;
    throw e;
  }
}

/** Actualiza usuario — LOCAL FIRST */
export async function updateUser(idOrPatch: any, maybePatch?: any) {
  await openDatabases();
  if (!localDB) throw new Error("localDB no inicializado");

  let _id: string;
  let patch: any;

  if (typeof maybePatch === "undefined") {
    const obj = idOrPatch || {};
    const key = obj._id || obj.id || obj.email || obj.name;
    if (!key) throw new Error("updateUser: falta identificador (_id | id | email | name)");
    _id = toUserDocId(typeof key === "string" ? key : String(key));
    patch = { ...obj };
  } else {
    _id = toUserDocId(idOrPatch);
    patch = { ...maybePatch };
  }

  delete patch._id;

  const doc = await localDB.get(_id);
  const updated = {
    ...doc,
    ...patch,
    _id,
    _rev: doc._rev,
    type: "user",
    updatedAt: new Date().toISOString(),
  };
  await localDB.put(updated); // << LOCAL ONLY
  return updated;
}

/** Borrado lógico — LOCAL FIRST */
export async function softDeleteUser(idOrKey: string) {
  await openDatabases();
  const _id = toUserDocId(idOrKey);
  const doc = await localDB.get(_id);
  doc.isActive = false;
  doc.updatedAt = new Date().toISOString();
  doc.deletedAt = doc.updatedAt;
  await localDB.put(doc); // << LOCAL ONLY
  return doc;
}

/** Borrado permanente — LOCAL FIRST */
export async function deleteUserById(idOrKey: string): Promise<boolean> {
  await openDatabases();
  const _id = toUserDocId(idOrKey);
  try {
    const doc = await localDB.get(_id);
    await localDB.remove(doc); // la sync replicará el delete
    return true;
  } catch (e: any) {
    if (e?.status === 404) return false;
    throw e;
  }
}

export async function hardDeleteUser(idOrKey: string): Promise<boolean> {
  return deleteUserById(idOrKey);
}

/** Busca por email en local */
export async function findUserByEmail(email: string) {
  await openDatabases();
  try {
    const res = await (localDB as any).find({
      selector: { type: "user", email },
      limit: 1,
    });
    if (res.docs && res.docs[0]) return res.docs[0];
  } catch {}

  const name = email.includes("@") ? email.split("@")[0] : email;
  try { return await localDB.get(`user:${name}`); } catch {}
  try { return await localDB.get(`user_${name}`); } catch {}

  return null;
}

/** Watch de cambios del doc de usuario (replicación) */
export async function watchUserDocByEmail(
  email: string,
  onUpdate: (doc: any) => void,
): Promise<() => void> {
  await openDatabases();
  if (!localDB) return () => {};

  const ids = [
    `user_${email}`,
    email.includes("@") ? `user:${email.split("@")[0]}` : `user:${email}`,
  ];

  const feed = localDB
    .changes({
      live: true,
      since: "now",
      include_docs: true,
      doc_ids: ids,
    })
    .on("change", (ch: any) => {
      if (ch?.doc) onUpdate(ch.doc);
    })
    .on("error", (err: any) => {
      console.warn("[watchUserDocByEmail] error", err?.message || err);
    });

  return () => {
    try { /* @ts-ignore */ feed?.cancel?.(); } catch {}
  };
}

export { localDB, remoteDB };
