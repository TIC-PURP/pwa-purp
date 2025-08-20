// src/lib/database.ts
// CouchDB + PouchDB (offline-first) con writes LOCAL-FIRST y login vía /couchdb/_session

const isClient = typeof window !== "undefined";

let PouchDB: any = null;
let localDB: any = null;
let remoteDB: any = null;
let syncHandler: any = null;

export type CouchEnv = { serverBase: string; dbName: string };

export function getCouchEnv(): CouchEnv {
  const raw = (process.env.NEXT_PUBLIC_COUCHDB_URL || "").trim();
  if (!raw) throw new Error("NEXT_PUBLIC_COUCHDB_URL no está definido");
  const url = new URL(raw);
  const path = url.pathname.replace(/\/+\$/, "");
  const parts = path.split("/").filter(Boolean);
  const dbName = parts[parts.length - 1] || "gestion_pwa";
  const serverBase = `${url.protocol}//${url.host}`;
  return { serverBase, dbName };
}

// Base para endpoints de DB (/_all_docs, /_changes, etc.)
function getRemoteDbBase() {
  const { serverBase } = getCouchEnv();
  return isClient ? "/api/couchdb" : `${serverBase}`;
}

// Base para endpoints de server (/_session)
function getRemoteServerBase() {
  const { serverBase } = getCouchEnv();
  return isClient ? "/api/couch" : `${serverBase}`;
}

// fetch con timeout
function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const opts = { ...init, signal: controller.signal };
  return fetch(input, opts).finally(() => clearTimeout(timer));
}

// Carga PouchDB + find
async function ensurePouch() {
  if (PouchDB) return;
  const mod = await import("pouchdb");
  const find = (await import("pouchdb-find")).default;
  PouchDB = (mod as any).default || mod;
  PouchDB.plugin(find);
}

/* ===== Helpers ===== */
function slug(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-");
}
function toUserDocId(input: string) {
  if (input.includes(":")) return input;
  if (input.startsWith("user_")) return `user:${slug(input.slice(5))}`;
  return `user:${slug(input)}`;
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
    role: data.role || "user",
    permissions: Array.isArray(data.permissions) ? data.permissions : ["read"],
    isActive: data.isActive !== false,
    createdAt: data.createdAt || now,
    updatedAt: now,
    ...data.extra,
  };
}

/* ===== Bases ===== */
export async function openDatabases() {
  if (!isClient) return;
  await ensurePouch();
  const { dbName } = getCouchEnv();

  if (!localDB) localDB = new PouchDB(`${dbName}_local`, { auto_compaction: true });

  if (!remoteDB) {
    const remoteBase = getRemoteDbBase();
    const remoteUrl = `${remoteBase}/${encodeURIComponent(dbName)}`;

    const opts: any = {
      skip_setup: true,
      fetch: (url: RequestInfo, opts2: any = {}) => {
        opts2 = opts2 || {};
        opts2.credentials = "include";
        return (window as any).fetch(url as any, opts2);
      },
      ajax: { withCredentials: true },
    };

    console.log("[couch] remote =", remoteUrl, "| mode = session-cookie");
    remoteDB = new PouchDB(remoteUrl, opts);
  }

  return { localDB, remoteDB };
}

/* ===== Sync ===== */
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

export async function stopSync() {
  if (syncHandler?.cancel) { try { await syncHandler.cancel(); } catch {} }
  syncHandler = null;
}

export async function loginOnlineToCouchDB(_name: string, _password: string) {
  const name = _name;
  const password = _password;

  const res = await fetch("/api/couch/_session", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name, password }).toString(),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return await res.json();
}

export async function logoutOnlineSession() {
  const base = getRemoteServerBase();
  try { await fetch(`${base}/_session`, { method: "DELETE", credentials: "include" }); } catch {}
}

/* ===== Login offline + CRUD usuarios ===== */
export async function authenticateUser(identifier: string, password: string) {
  try {
    const { verifyOffline } = await import("@/lib/auth/offline");
    const ok = await verifyOffline(identifier, password);
    if (ok.ok) {
      return await findUserByEmail(identifier);
    }
  } catch {}
  return null;
}

export async function guardarUsuarioOffline(user: any) {
  await openDatabases();
  if (!localDB) throw new Error("localDB no inicializado");
  const key = slug(user.email || user.name || user.id || "");
  const _id = `user:${key}`;
  const toSave = { ...buildUserDocFromData(user), _id, id: `user_${key}`, updatedAt: new Date().toISOString() };
  try {
    const existing = await localDB.get(_id);
    toSave._rev = existing._rev;
    await localDB.put(toSave);
  } catch (err: any) {
    if (err?.status === 404) await localDB.put(toSave);
    else { console.error("guardarUsuarioOffline", err); throw err; }
  }
}

export async function initializeDefaultUsers() {
  await openDatabases();
  if (!localDB) return;
  const now = new Date().toISOString();
  const defaultUsers = [
    { name: "Manager", email: "manager@purp.com.mx", password: "Purp2023@", role: "manager", permissions: ["read","write","delete","manage_users"] },
  ];
  for (const user of defaultUsers) {
    const doc = buildUserDocFromData({ ...user, createdAt: now });
    try { await localDB.get(doc._id); } catch (e: any) { if (e?.status === 404) await localDB.put(doc); }
  }
}

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
  await localDB.put(doc);
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
  await localDB.put(updated);
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
  await localDB.put(doc);
  return doc;
}

/** Borrado permanente — LOCAL FIRST */
export async function deleteUserById(idOrKey: string): Promise<boolean> {
  await openDatabases();
  const _id = toUserDocId(idOrKey);
  try {
    const doc = await localDB.get(_id);
    await localDB.remove(doc);
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
  if (!localDB) return null;

  const e = String(email || "").trim().toLowerCase();

  try {
    const res = await (localDB as any).find({
      selector: { type: "user", email: e },
      limit: 1,
    });
    if (res.docs && res.docs[0]) return res.docs[0];
  } catch {}

  const key = slug(e);
  const candidates = [
    `user:${key}`,
    `user_${key}`,
  ];

  const localPart = slug(e.includes("@") ? e.split("@")[0] : e);
  candidates.push(`user:${localPart}`);

  for (const id of candidates) {
    try { return await localDB.get(id); } catch {}
  }

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
