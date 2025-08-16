// src/lib/database.ts
// Funciones para CouchDB + PouchDB (offline-first) y CRUD de usuarios

const isClient = typeof window !== "undefined";

let PouchDB: any = null;     // clase PouchDB (se carga en cliente)
let localDB: any = null;     // instancia local (IndexedDB)
let remoteDB: any = null;    // instancia remota (CouchDB vía proxy /couchdb)
let syncHandler: any = null; // handler de replicación viva

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

/** Carga PouchDB (browser) y plugin find en cliente */
async function ensurePouch() {
  if (PouchDB) return;
  // Importamos sólo en cliente para evitar SSR issues
  const mod = await import("pouchdb-browser");
  const find = (await import("pouchdb-find")).default;
  PouchDB = (mod as any).default || mod;
  PouchDB.plugin(find);
}

/** Helpers de IDs para DB particionada (user:clave) y compat con user_ */
function slug(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-");
}
function toUserDocId(input: string) {
  if (!input) throw new Error("toUserDocId: id vacío");
  // Ya particionado
  if (input.includes(":")) return input;
  // Legacy user_<...>
  if (input.startsWith("user_")) return `user:${slug(input.slice(5))}`;
  // Email/usuario suelto
  return `user:${slug(input)}`;
}

function buildUserDocFromData(data: any) {
  const key = slug(data.email || data.name || data.id || Date.now().toString());
  const _id = `user:${key}`;
  const now = new Date().toISOString();
  return {
    _id,
    id: `user_${key}`, // id lógico para la UI
    type: "user",
    name: data.name || key,
    email: (data.email || "").toLowerCase(),
    password: data.password || "",
    role: data.role || "user",
    permissions: Array.isArray(data.permissions) ? data.permissions : ["read"],
    isActive: data.isActive !== false,
    createdAt: data.createdAt || now,
    updatedAt: now,
    ...data.extra, // por si pasas campos adicionales
  };
}

export async function openDatabases() {
  if (!isClient) return;
  await ensurePouch();
  const { serverBase, dbName } = getCouchEnv();

  if (!localDB) {
    localDB = new PouchDB(`${dbName}_local`, { auto_compaction: true });
  }

  if (!remoteDB) {
    // en el navegador usamos SIEMPRE el proxy same-origin
    const remoteUrl = isClient
      ? `/couchdb/${encodeURIComponent(dbName)}`
      : `${serverBase}/${encodeURIComponent(dbName)}`;

    remoteDB = new PouchDB(remoteUrl, {
      skip_setup: true,
      fetch: (url: RequestInfo, opts: any = {}) => {
        opts = opts || {};
        opts.credentials = "include"; // cookie AuthSession first-party
        return (window as any).fetch(url as any, opts);
      },
      ajax: { withCredentials: true },
    });
  }

  return { localDB, remoteDB };
}


/** Login online contra /_session (name = usuario o email) */
export async function loginOnlineToCouchDB(name: string, password: string) {
  const { serverBase } = getCouchEnv();
  const body = new URLSearchParams({ name, password }).toString();

  // En cliente, pegamos al proxy same-origin para que la cookie sea de vercel.app
  const url = isClient ? "/couchdb/_session" : `${serverBase}/_session`;

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`/_session ${res.status} ${res.statusText} ${txt}`);
  }
  return true;
}

/** Cierra la sesión del servidor */
export async function logoutOnlineSession() {
  const { serverBase } = getCouchEnv();
  const url = isClient ? "/couchdb/_session" : `${serverBase}/_session`;
  try {
    await fetch(url, { method: "DELETE", credentials: "include" });
  } catch {}
}

/** Arranca replicación continua (offline-first) */
export async function startSync() {
  if (!isClient) return;
  await openDatabases();
  if (!localDB || !remoteDB) return;

  if (syncHandler && syncHandler.cancel) return syncHandler;

  const opts: any = { live: true, retry: true };
  // Heartbeat/timeouts útiles detrás de CDN/proxy
  opts.heartbeat = 25000;
  opts.timeout = 55000;

  syncHandler = localDB.sync(remoteDB, opts);
  syncHandler
    .on("active", () => console.log("[sync] active"))
    .on("paused", (e: any) => {
      if (e) {
        console.warn("[sync] paused", e?.status, e?.message || e);
        // 401 aquí suele indicar cookie expirada → UI puede forzar re-login
      } else {
        console.log("[sync] paused");
      }
    })
    .on("change", (i: any) => {
      // console.log("[sync] change", i?.direction);
    })
    .on("error", (e: any) => {
      console.error("[sync] error", e?.status, e?.message || e);
    });

  return syncHandler;
}

/** Detiene replicación */
export async function stopSync() {
  if (syncHandler?.cancel) {
    try {
      await syncHandler.cancel();
    } catch {}
  }
  syncHandler = null;
}

/** Login offline contra Pouch local */
export async function authenticateUser(identifier: string, password: string) {
  await openDatabases();
  if (!localDB) return null;

  const candidates = [
    `user_${identifier}`,
    identifier.includes("@") ? `user_${identifier.split("@")[0]}` : null,
  ].filter(Boolean) as string[];

  // Índice por "id" para compatibilidad
  try {
    await localDB.createIndex({ index: { fields: ["id"] }, name: "idx-id" });
  } catch {}
  for (const cand of candidates) {
    const r = await localDB.find({ selector: { id: cand } });
    if (r.docs?.[0] && r.docs[0].password === password) return r.docs[0];
  }
  return null;
}

/** ======== Utilidades de índice ======== */
async function ensureUserIndexes() {
  await openDatabases();
  if (!localDB) return;
  try {
    await localDB.createIndex({
      index: { fields: ["type", "updatedAt"] },
      name: "idx-type-updatedAt",
      ddoc: "idx-type-updatedAt",
    });
  } catch {}
  try {
    await localDB.createIndex({
      index: { fields: ["type", "email"] },
      name: "idx-type-email",
      ddoc: "idx-type-email",
    });
  } catch {}
}

/** Guarda/actualiza usuario en Pouch local (upsert) */
export async function guardarUsuarioOffline(user: any) {
  await openDatabases();
  if (!localDB) throw new Error("localDB no inicializado");

  const key = slug(user.email || user.name || user.id || "");
  const _id = `user:${key}`;

  const now = new Date().toISOString();
  const toSave = {
    ...buildUserDocFromData(user),
    _id,
    id: `user_${key}`,
    type: "user",
    updatedAt: now,
  };

  try {
    const existing = await localDB.get(_id);
    toSave._rev = existing._rev;
    toSave.createdAt = existing.createdAt || toSave.createdAt;
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

/** Semilla local por si entras offline la primera vez */
export async function initializeDefaultUsers() {
  await openDatabases();
  if (!localDB) return;
  const now = new Date().toISOString();
  const def = buildUserDocFromData({
    name: "Mario Acosta",
    email: "mario_acosta@purp.com.mx",
    password: "Purp_*2023@",
    role: "manager",
    permissions: ["read", "write", "delete", "manage"],
    createdAt: now,
  });
  try {
    await localDB.get(def._id);
  } catch (e: any) {
    if (e?.status === 404) await localDB.put(def);
  }
}

/* ============================
   ==========  USERS  =========
   ============================
   CRUD que usa la base local (offline-first); la sync replica al remoto.
*/

export async function getAllUsers(opts?: {
  includeInactive?: boolean;
  limit?: number;
}) {
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
    // Fallback por prefijo en _id
    const res = await localDB.allDocs({
      include_docs: true,
      startkey: "user:",
      endkey: "user;\ufff0",
      limit,
    });
    const docs = (res.rows || [])
      .map((r: any) => r.doc)
      .filter(Boolean)
      .filter((d: any) =>
        includeInactive
          ? d.type === "user"
          : d.type === "user" && d.isActive !== false,
      );
    docs.sort((a: any, b: any) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
    );
    return docs;
  }
}

/** Crea usuario (o lo upserta si ya existe) */
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

/** Obtiene un usuario por ID (acepta user:xxx | user_xxx | email/usuario) */
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

/** Actualiza un usuario (updateUser(idOrKey, patch) o updateUser(patchObject)) */
export async function updateUser(idOrPatch: any, maybePatch?: any) {
  await openDatabases();
  if (!localDB) throw new Error("localDB no inicializado");

  let _id: string;
  let patch: any;

  if (typeof maybePatch === "undefined") {
    const obj = idOrPatch || {};
    const key = obj._id || obj.id || obj.email || obj.name;
    if (!key)
      throw new Error(
        "updateUser: falta identificador (_id | id | email | name)",
      );
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

/** Borrado lógico (isActive:false) */
export async function softDeleteUser(idOrKey: string) {
  await openDatabases();
  const _id = toUserDocId(idOrKey);
  const doc = await localDB.get(_id);
  doc.isActive = false;
  doc.updatedAt = new Date().toISOString();
  (doc as any).deletedAt = doc.updatedAt;
  await localDB.put(doc);
  return doc;
}

/** Restaura usuario (isActive:true) */
export async function restoreUser(idOrKey: string) {
  await openDatabases();
  const _id = toUserDocId(idOrKey);
  const doc = await localDB.get(_id);
  doc.isActive = true;
  doc.updatedAt = new Date().toISOString();
  delete (doc as any).deletedAt;
  await localDB.put(doc);
  return doc;
}

/** Borrado permanente (hard delete) por id/clave. */
export async function deleteUserById(idOrKey: string): Promise<boolean> {
  await openDatabases();
  const _id = toUserDocId(idOrKey);
  try {
    const doc = await localDB.get(_id);
    await localDB.remove(doc); // elimina del local; la sync lo replica al remoto
    return true;
  } catch (e: any) {
    if (e?.status === 404) return false;
    throw e;
  }
}

export async function hardDeleteUser(idOrKey: string): Promise<boolean> {
  return deleteUserById(idOrKey);
}

/** Busca usuario por email (type + email) con índice Mango */
export async function findUserByEmail(email: string) {
  await openDatabases();
  await ensureUserIndexes();
  const e = (email || "").trim().toLowerCase();
  if (!e) return null;

  try {
    const res = await (localDB as any).find({
      selector: { type: "user", email: e },
      limit: 1,
    });
    if (res.docs && res.docs[0]) return res.docs[0];
  } catch {}

  // Fallback por _id particionado
  try {
    const doc = await localDB.get(`user:${e.split("@")[0]}`);
    return doc as any;
  } catch {}

  // Fallback legacy user_<email>
  try {
    const doc = await localDB.get(`user_${e}`);
    return doc as any;
  } catch {}

  return null;
}

/** Suscripción a cambios del doc de usuario por email */
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
    try {
      feed?.cancel?.();
    } catch {}
  };
}

export { localDB, remoteDB };
