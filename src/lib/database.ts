// src/lib/database.ts
// CouchDB + PouchDB (offline-first) con writes LOCAL-FIRST y login via /couchdb/_session

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
  if (!raw) throw new Error("NEXT_PUBLIC_COUCHDB_URL no esta definido");

  const url = new URL(raw);
  const path = url.pathname.replace(/\/+$/, "");
  const parts = path.split("/").filter(Boolean);
  const dbName = parts[parts.length - 1] || "pwa-purp";

  const serverBase = `${url.protocol}//${url.host}`;
  return { serverBase, dbName };
}

/** Cuando corre en el navegador usamos el proxy /couchdb (same-origin con cookie); en SSR va directo */
function getRemoteBase() {
  const { serverBase } = getCouchEnv();
  return isClient ? "/api/couch" : serverBase;
}

/** fetch con timeout (para no colgarnos en login) */
function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const opts = { ...init, signal: controller.signal };
  return fetch(input, opts).finally(() => clearTimeout(timer));
}

// --- Helpers para reintentar operaciones locales si IndexedDB esta cerrando ---
function isClosingError(err: any) {
  const name = (err && err.name) || "";
  const msg = (err && err.message) || "";
  return /InvalidStateError/i.test(name) || /connection is closing/i.test(String(msg));
}
async function safeLocalGet(id: string) {
  try { return await (localDB as any).get(id); }
  catch (e) {
    if (isClosingError(e)) { try { /* force reopen */ /* @ts-ignore */ localDB = null; } catch {} await openDatabases(); return await (localDB as any).get(id); }
    throw e;
  }
}
async function safeLocalPut(doc: any) {
  try { return await (localDB as any).put(doc); }
  catch (e) {
    if (isClosingError(e)) { try { /* @ts-ignore */ localDB = null; } catch {} await openDatabases(); return await (localDB as any).put(doc); }
    throw e;
  }
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

/** Helpers de IDs / normalizacion */
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
const MODULE_PERMISSION_DEFAULTS = { MOD_A: "NONE", MOD_B: "NONE", MOD_C: "NONE", MOD_D: "NONE" } as const;

type ModulePermissionKey = keyof typeof MODULE_PERMISSION_DEFAULTS;
type ModulePermissionValue = typeof MODULE_PERMISSION_DEFAULTS[ModulePermissionKey];
type ModulePermissionPatch = Partial<Record<ModulePermissionKey, ModulePermissionValue>>;

function sanitizeModulePermissionPatch(raw: any): ModulePermissionPatch {
  const result: ModulePermissionPatch = {};
  if (!raw || typeof raw !== "object") {
    return result;
  }
  for (const key of Object.keys(MODULE_PERMISSION_DEFAULTS)) {
    const value = (raw as any)[key];
    if (value === "FULL" || value === "READ" || value === "NONE") {
      result[key as ModulePermissionKey] = value;
    }
  }
  return result;
}

function withModulePermissionDefaults(raw: any): Record<ModulePermissionKey, ModulePermissionValue> {
  return { ...MODULE_PERMISSION_DEFAULTS, ...sanitizeModulePermissionPatch(raw) };
}

function buildUserDocFromData(data: any) {
  const key = slug(data.email || data.name || data.id || Date.now().toString());
  const _id = `user:${key}`;
  const now = new Date().toISOString();
  const moduleSource = (typeof data.modulePermissions === "object" && !Array.isArray(data.modulePermissions))
    ? data.modulePermissions
    : (!Array.isArray(data.permissions) && typeof data.permissions === "object" ? data.permissions : undefined);
  const modulePermissions = withModulePermissionDefaults(moduleSource);
  const permissions = Array.isArray(data.permissions) ? data.permissions : ["read"];
  return {
    _id,
    id: `user_${key}`,
    type: "user",
    name: data.name || key,
    email: data.email || "",
    password: data.password || "",
    role: data.role || "user",
    permissions,
    modulePermissions,
    isActive: data.isActive !== false,
    createdAt: data.createdAt || now,
    updatedAt: now,
    ...data.extra,
  };
}

// Elimina campos reservados no permitidos por CouchDB (claves que empiezan por "_"
// excepto las reconocidas). Evita errores de validacion como
// "Bad special document member: ___writePath".
function sanitizeForCouch<T extends Record<string, any>>(doc: T): T {
  const allowed = new Set(["_id", "_rev", "_deleted", "_attachments"]);
  const out: any = {};
  for (const k in doc) {
    if (k.startsWith("_") && !allowed.has(k)) continue;
    out[k] = (doc as any)[k];
  }
  return out as T;
}
async function saveDocViaAdmin(doc: any) {
  try {
    const res = await fetch("/api/admin/couch/app-users", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ doc }),
    });
    if (!res.ok) {
      try {
        const text = await res.text();
        console.warn("[database] admin save failed", res.status, text);
      } catch {}
      return null;
    }
    try {
      const data = await res.json();
      const couch = (data && (data.couch || data)) || null;
      const rev = couch?.rev;
      return { rev, data: couch };
    } catch {
      return { rev: undefined, data: null };
    }
  } catch (error) {
    console.warn("[database] admin save error", (error as any)?.message || error);
    return null;
  }
}

async function pushUserDocToRemote(doc: any): Promise<{ rev?: string; path: "remote" | "remote-admin" } | null> {
  if (remoteDB && typeof (remoteDB as any).put === "function") {
    try {
      const res = await (remoteDB as any).put(doc);
      return { rev: res.rev, path: "remote" };
    } catch (error: any) {
      if (error?.status === 409) {
        throw error;
      }
      const adminResult = await saveDocViaAdmin(doc);
      if (adminResult) {
        return { rev: adminResult.rev, path: "remote-admin" };
      }
      console.warn("[database] remote put failed", (error as any)?.message || error);
      return null;
    }
  }
  const adminResult = await saveDocViaAdmin(doc);
  if (adminResult) {
    return { rev: adminResult.rev, path: "remote-admin" };
  }
  return null;
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
    remoteDB = new PouchDB(remoteUrl, {
      skip_setup: true,
      fetch: (url: RequestInfo, opts: any = {}) => {
        opts = opts || {};
        opts.credentials = "include"; // enviar cookie AuthSession
        return (window as any).fetch(url as any, opts);
      },
      ajax: { withCredentials: true },
    });
  }

  return { localDB, remoteDB };
}

/** Arranca replicacion continua (local <-> remote) */
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

/** Detiene replicacion */
export async function stopSync() {
  try {
    // Evitar cuelgues: no esperar a que cancel() resuelva
    // Algunos adaptadores de PouchDB no devuelven una Promise resoluble aqu
    // y dejar await puede colgar flujos como el login.
    // @ts-ignore
    if (syncHandler?.cancel) {
      try { syncHandler.cancel(); } catch {}
    }
  } catch {}
  syncHandler = null;
}

/** Login online contra /api/auth/login */
export async function loginOnlineToCouchDB(email: string, password: string) {
  console.log("[db] loginOnlineToCouchDB start", { email });
  const body = JSON.stringify({ email, password });
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `/api/auth/login`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body,
      },
      12000,
    );
  } catch (err) {
    console.error("[db] loginOnlineToCouchDB fetch error", err);
    throw new Error("No hay conexin a internet. Revisa tu conexin e intntalo nuevamente.");
  }
  const data = await res.json().catch(() => ({}));
  console.log("[db] loginOnlineToCouchDB response", res.status, data);
  // Mejor manejo de errores: si el API devolvi error, propagar mensaje claro
  if (!res.ok || !data?.ok) {
    const msg = (data && (data.error || data.reason)) || res.statusText || "login failed";
    throw new Error(String(msg));
  }
  // Devolvemos los datos para usar roles en el cliente
  return data as any; // { ok: boolean, user?: string, roles?: string[] }
}

/** Cierra la sesin del servidor */
export async function logoutOnlineSession() {
  const base = getRemoteBase();
  try {
    await fetch(`${base}/_session`, { method: "DELETE", credentials: "include" });
  } catch {}
}

/** Login offline contra Pouch local */
export async function authenticateUser(identifier: string, password: string) {
  await openDatabases();
  if (!localDB) throw new Error("localDB no inicializado");

  // 1) Intentar match exacto por email (ms robusto)
  try {
    await ensureUserIndexes();
    const r = await localDB.find({ selector: { type: "user", email: identifier }, limit: 1 });
    const doc = r.docs?.[0];
    if (doc && doc.password === password) return doc;
  } catch {}

  // 2) Intentar por 'id' con slug del email/username
  const ids: string[] = [];
  const emailSlug = slug(identifier);
  ids.push(`user_${emailSlug}`);
  if (identifier.includes("@")) {
    const name = identifier.split("@")[0];
    ids.push(`user_${slug(name)}`);
  }
  try { await localDB.createIndex({ index: { fields: ["id"] }, name: "idx-id" }); } catch {}
  for (const id of ids) {
    try {
      const r = await localDB.find({ selector: { id }, limit: 1 });
      const doc = r.docs?.[0];
      if (doc && doc.password === password) return doc;
    } catch {}
  }

  // 3) Intentar por _id (user:slug)
  const docIds: string[] = [`user:${emailSlug}`];
  if (identifier.includes("@")) {
    const name = identifier.split("@")[0];
    docIds.push(`user:${slug(name)}`);
  }
  for (const _id of docIds) {
    try {
      const doc = await localDB.get(_id);
      if (doc && doc.password === password) return doc;
    } catch {}
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


/* ============================
   ==========  USERS  =========
   ============================ */

/** ndices para consultas */
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
    const docs = (r.docs || []).map(normalizeUserDocShape);
    return docs;
  } catch {
    const resA = await localDB.allDocs({
      include_docs: true,
      startkey: "user:",
      endkey: "user:\ufff0",
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
    const normalized = docs.map(normalizeUserDocShape);
    normalized.sort((a: any, b: any) =>
      String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
    );
    return normalized;
  }
}

/**
 * Lista cuentas de CouchDB /_users va API admin (solo manager/admin).
 * Devuelve usuarios mapeados al shape de la app con permisos derivados.
 */
export async function getAllUsersAsManager(): Promise<any[]> {
  try {
    const res = await fetch(`/api/admin/couch/users`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({} as any));
    const list = Array.isArray((data as any)?.users) ? (data as any).users : [];

    // Traer tambien lo local para fusionar metadatos si existen
    let locals: Record<string, any> = {};
    try {
      const localList = await getAllUsers({ includeInactive: true, limit: 5000 });
      for (const u of localList) {
        const key = String((u.email || u.name || "").toLowerCase());
        if (key) locals[key] = u;
      }
    } catch {}

    // Util para mapear roles de Couch a Role de la app
    const toRole = (roles: string[]): "admin" | "manager" | "user" => {
      const set = new Set((roles || []).map(String));
      if (set.has("admin")) return "admin";
      if (set.has("manager")) return "manager";
      return "user";
    };

    const now = new Date().toISOString();
    const fullPerms = ["read", "write", "delete", "manage_users"] as any[];

    const mapped = list.map((a: any) => {
      const email = String(a?.name || "").trim();
      const baseName = email.includes("@") ? email.split("@")[0] : email;
      const role = toRole(Array.isArray(a?.roles) ? a.roles : []);
      const local = locals[email.toLowerCase()];
      // Para manager, asegurar permisos completos coherentes con validaciones
      const permissions = role === "manager" ? fullPerms.slice() : Array.isArray(local?.permissions) ? local.permissions : ["read"];
      const modulePermissions = role === "manager"
        ? { MOD_A: "FULL", MOD_B: "FULL", MOD_C: "FULL", MOD_D: "FULL" }
        : withModulePermissionDefaults(local?.modulePermissions);
      return {
        _id: `user:${(email || baseName).toLowerCase()}`,
        id: `user_${(email || baseName).toLowerCase()}`,
        name: local?.name ?? baseName,
        email,
        password: local?.password ?? "", // nunca devolvemos real; solo display
        role,
        permissions,
        modulePermissions,
        isActive: local ? (local.isActive !== false) : true,
        createdAt: local?.createdAt || now,
        updatedAt: local?.updatedAt || now,
      } as any;
    });

    // Incluir locales que no tienen cuenta en _users (usuarios solo locales)
    for (const key of Object.keys(locals)) {
      const email = key;
      if (!mapped.some((m: any) => String(m.email || "").toLowerCase() === email)) {
        mapped.push(locals[key]);
      }
    }

    // Persistir listado en la base local para soporte offline completo
    try {
      await openDatabases();
      if (localDB) {
        for (const u of mapped) {
          try {
            const existing = await localDB.get(u._id).catch(() => null);
            const toSave = sanitizeForCouch({
              ...(existing || {}),
              ...u,
              _id: u._id,
              id: u.id,
              type: "user",
              updatedAt: new Date().toISOString(),
            });
            if (existing && existing._rev) toSave._rev = existing._rev;
            await safeLocalPut(toSave);
          } catch {}
        }
      }
    } catch {}

    // Ordenar por updatedAt desc como en getAllUsers
    mapped.sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return mapped;
  } catch (e) {
    // Si falla por permisos/red, devolvemos el local como fallback
    try {
      return await getAllUsers({ includeInactive: true });
    } catch {
      return [];
    }
  }
}

/** Normaliza formas de permisos para evitar crashes en UI */
function normalizeUserDocShape(u: any) {
  const out: any = { ...u };
  if (!Array.isArray(out.permissions)) {
    out.permissions = [];
  }
  const mp = out.modulePermissions;
  const moduleSource = (mp && typeof mp === "object" && !Array.isArray(mp))
    ? mp
    : (!Array.isArray(u.permissions) && typeof u.permissions === "object" ? u.permissions : undefined);
  out.modulePermissions = withModulePermissionDefaults(moduleSource);
  return out;
}

/** Limpia campos invlidos (como ___writePath) de documentos de usuario existentes */
export async function cleanupUserDocs(): Promise<number> {
  await openDatabases();
  if (!localDB) return 0;
  const allowed = new Set(["_id", "_rev", "_deleted", "_attachments"]);
  const needsClean = (doc: any) => {
    const badUnderscore = Object.keys(doc).some(k => k.startsWith("_") && !allowed.has(k));
    const badPerms = !Array.isArray(doc.permissions);
    const badModule = !doc.modulePermissions || Array.isArray(doc.modulePermissions) || typeof doc.modulePermissions !== "object";
    return badUnderscore || badPerms || badModule;
  };

  let docs: any[] = [];
  try {
    const res = await (localDB as any).find({ selector: { type: "user" }, limit: 5000 });
    docs = res.docs || [];
  } catch {
    const resA = await localDB.allDocs({ include_docs: true, startkey: "user:", endkey: "user:\ufff0", limit: 5000 });
    const resB = await localDB.allDocs({ include_docs: true, startkey: "user_", endkey: "user_\ufff0", limit: 5000 });
    docs = [...resA.rows, ...resB.rows].map((r: any) => r.doc).filter(Boolean);
  }

  let cleaned = 0;
  for (const d of docs) {
    if (d?.type !== "user") continue;
    if (!needsClean(d)) continue;
    const sanitized = normalizeUserDocShape(sanitizeForCouch(d));
    try {
      await localDB.put({ ...sanitized });
      cleaned++;
    } catch (e) {
      // si choca por rev, intentamos traer y reintentar una vez
      try {
        const latest = await localDB.get(d._id);
        const merged = sanitizeForCouch({ ...latest, ...sanitized, _rev: latest._rev });
        await localDB.put(merged);
        cleaned++;
      } catch {}
    }
  }
  return cleaned;
}

/** Crea (o upserta) usuario  LOCAL FIRST */
export async function createUser(data: any) {
  await openDatabases();
  const doc = buildUserDocFromData(data);
  const online = typeof navigator !== "undefined" && navigator.onLine && remoteDB;

  const sanitizedDoc = sanitizeForCouch(doc);

  if (online) {
    try {
      const remoteResult = await pushUserDocToRemote({ ...sanitizedDoc });
      if (remoteResult) {
        if (remoteResult.rev) {
          doc._rev = remoteResult.rev;
          sanitizedDoc._rev = remoteResult.rev;
        }
        if (!('remoteCreatedAt' in doc) || !doc.remoteCreatedAt) {
          (doc as any).remoteCreatedAt = new Date().toISOString();
          (sanitizedDoc as any).remoteCreatedAt = (doc as any).remoteCreatedAt;
        }
        try { await localDB.put({ ...sanitizedDoc }); } catch {}
        try {
          const roles = [doc.role].filter(Boolean) as string[];
          await upsertRemoteAuthUser({ name: doc.email || doc.name, password: doc.password, roles });
        } catch (e) { console.warn("[createUser] _users upsert failed", (e as any)?.message || e); }
        return { ...doc, ___writePath: remoteResult.path } as any;
      }
    } catch (err) {
      console.warn("[createUser] remote put failed, falling back to local", err);
    }
  }

  try {
    const existing = await localDB.get(doc._id);
    doc._rev = existing._rev;
    doc.createdAt = existing.createdAt || doc.createdAt;
  } catch {}
  const toLocal = sanitizeForCouch(doc);
  await localDB.put(toLocal); // LOCAL ONLY. La replicacion lo sube.
  // If online, still try to create _users auth so the user can login immediately
  try {
    const online2 = typeof navigator !== "undefined" && navigator.onLine;
    if (online2) {
      const roles = [doc.role].filter(Boolean) as string[];
      await upsertRemoteAuthUser({ name: doc.email || doc.name, password: doc.password, roles });
    }
  } catch {}
  return { ...toLocal, ___writePath: "local" } as any;
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

/** Actualiza usuario  LOCAL FIRST */
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
  if (typeof patch.password === "string" && patch.password.trim() === "") {
    delete patch.password;
  }

  let doc: any;
  try {
    doc = await safeLocalGet(_id);
  } catch (e: any) {
    if (e?.status === 404) {
      doc = buildUserDocFromData({ _id, id: _id.replace(":", "_"), ...patch });
    } else {
      throw e;
    }
  }

  const explicitModulePatch: ModulePermissionPatch = (patch.modulePermissions && typeof patch.modulePermissions === "object" && !Array.isArray(patch.modulePermissions))
    ? sanitizeModulePermissionPatch(patch.modulePermissions)
    : {};
  if (patch.modulePermissions) delete patch.modulePermissions;

  let modulePatch: ModulePermissionPatch = { ...explicitModulePatch };
  if (!Array.isArray(patch.permissions) && typeof patch.permissions === "object") {
    modulePatch = { ...modulePatch, ...sanitizeModulePermissionPatch(patch.permissions) };
    delete patch.permissions;
  }

  if (Object.keys(modulePatch).length === 0) {
    modulePatch = {};
  }

  const permissions = Array.isArray(patch.permissions)
    ? patch.permissions
    : (Array.isArray(doc.permissions) ? doc.permissions : []);

  const modulePermissions = { ...withModulePermissionDefaults(doc.modulePermissions), ...modulePatch };

  const updated = {
    ...doc,
    ...patch,
    _id,
    _rev: doc._rev,
    type: "user",
    permissions,
    modulePermissions,
    updatedAt: new Date().toISOString(),
  } as any;

  const online = typeof navigator !== "undefined" && navigator.onLine && remoteDB;

  const syncAuthAccount = async (previous: any, current: any) => {
    try {
      const roles = [current.role].filter(Boolean) as string[];
      const prevActive = previous?.isActive !== false;
      const curActive = current.isActive !== false;
      const prevIdentity = (previous?.email || previous?.name || "").trim();
      const currentIdentity = (current.email || current.name || "").trim();
      const changedIdentity = prevIdentity && currentIdentity && prevIdentity !== currentIdentity;

      if (prevActive !== curActive) {
        if (!curActive) {
          await deleteRemoteAuthUser(prevIdentity || currentIdentity);
        } else {
          if (changedIdentity) {
            await deleteRemoteAuthUser(prevIdentity);
          }
          await upsertRemoteAuthUser({ name: currentIdentity, password: current.password, roles });
        }
      } else if (curActive) {
        if (changedIdentity) {
          await deleteRemoteAuthUser(prevIdentity);
        }
        await upsertRemoteAuthUser({ name: currentIdentity, password: patch.password, roles });
      }
    } catch (error) {
      console.warn("[updateUser] _users auth sync failed", (error as any)?.message || error);
    }
  };

  const baseSanitized = sanitizeForCouch(updated);

  if (online) {
    try {
      const remoteResult = await pushUserDocToRemote({ ...baseSanitized });
      if (remoteResult) {
        if (remoteResult.rev) {
          updated._rev = remoteResult.rev;
          baseSanitized._rev = remoteResult.rev;
        }
        if (!("remoteCreatedAt" in updated) || !updated.remoteCreatedAt) {
          (updated as any).remoteCreatedAt = new Date().toISOString();
          (baseSanitized as any).remoteCreatedAt = (updated as any).remoteCreatedAt;
        }
        try {
          await safeLocalPut({ ...baseSanitized });
        } catch {}
        await syncAuthAccount(doc, updated);
        return { ...baseSanitized, ___writePath: remoteResult.path } as any;
      }
    } catch (err: any) {
      if (err?.status === 409 && remoteDB && typeof (remoteDB as any).get === "function") {
        try {
          const latest = await (remoteDB as any).get(_id);
          const latestModules = withModulePermissionDefaults(latest?.modulePermissions);
          const mergedModules = { ...latestModules, ...modulePatch };
          const merged = {
            ...latest,
            ...patch,
            _id,
            _rev: latest._rev,
            type: "user",
            permissions,
            modulePermissions: mergedModules,
            updatedAt: new Date().toISOString(),
          } as any;
          if (!("remoteCreatedAt" in merged) || !merged.remoteCreatedAt) {
            (merged as any).remoteCreatedAt = new Date().toISOString();
          }
          const mergedSanitized = sanitizeForCouch(merged);
          const conflictResult = await pushUserDocToRemote({ ...mergedSanitized });
          if (conflictResult) {
            if (conflictResult.rev) {
              merged._rev = conflictResult.rev;
              mergedSanitized._rev = conflictResult.rev;
            }
            try {
              await safeLocalPut({ ...mergedSanitized });
            } catch {}
            await syncAuthAccount(latest, merged);
            return { ...mergedSanitized, ___writePath: conflictResult.path } as any;
          }
        } catch (e2) {
          console.warn("[updateUser] 409 retry failed, falling back to local", e2);
        }
      } else {
        console.warn("[updateUser] remote put failed, falling back to local", err);
      }
    }
  }

  const toLocal = sanitizeForCouch(updated);
  await safeLocalPut(toLocal);
  return { ...toLocal, ___writePath: "local" } as any;
}
/** Borrado logico - LOCAL FIRST */
// deprecated: no longer used; keep for reference
/* removed: softDeleteUser(idOrKey: any) {
  await openDatabases();
  const key = typeof idOrKey === "string" ? idOrKey : (idOrKey?._id || idOrKey?.id || idOrKey?.email || idOrKey?.name || "");
  const _id = toUserDocId(key);
  let doc: any;
  try {
    doc = await localDB.get(_id);
  } catch (e: any) {
    if (e?.status === 404) {
      // Crear doc base para permitir desactivacion de usuarios listados desde _users
      const email = typeof idOrKey === "object" ? (idOrKey.email || idOrKey.name || "") : (key.includes("@") ? key : "");
      doc = buildUserDocFromData({ _id, id: _id.replace(":", "_"), email, name: email ? (email.split("@")[0]) : key });
    } else {
      throw e;
    }
  }
  doc.isActive = false;
  doc.updatedAt = new Date().toISOString();
  await localDB.put(sanitizeForCouch(doc)); // << LOCAL ONLY
  try {
    const online = typeof navigator !== "undefined" && navigator.onLine;
    if (online) await deleteRemoteAuthUser(doc.email || doc.name);
  } catch {}
  return sanitizeForCouch(doc);
} */

/** Borrado permanente - LOCAL FIRST */
export async function deleteUserById(idOrKey: string): Promise<boolean> {
  await openDatabases();
  const _id = toUserDocId(idOrKey);
  try {
    const doc = await localDB.get(_id);
    await localDB.remove(doc); // la sync replicara el delete
    return true;
  } catch (e: any) {
    if (e?.status === 404) return false;
    throw e;
  }
}

/** Alias para realizar borrado permanente */
export async function hardDeleteUser(idOrKey: any): Promise<boolean> {
  // Best-effort: remove CouchDB _users account before deleting local doc
  try {
    await openDatabases();
    const online = typeof navigator !== "undefined" && navigator.onLine;
    if (online) {
      try {
        let email = "";
        if (typeof idOrKey === "string") {
          // Si nos pasan email directamente
          if (idOrKey.includes("@")) email = idOrKey;
          else {
            // Intentar resolver por doc local si existe
            try {
              const _id = toUserDocId(idOrKey);
              const doc = await localDB.get(_id);
              email = (doc && (doc.email || doc.name)) || "";
            } catch {}
          }
        } else if (idOrKey && typeof idOrKey === "object") {
          email = String(idOrKey.email || idOrKey.name || "");
        }
        if (email) {
          await fetch(`/api/admin/couch/users?name=${encodeURIComponent(email)}`, {
            method: "DELETE",
            credentials: "include",
          });
        }
      } catch {}
    }
  } catch {}
  return deleteUserById(typeof idOrKey === "string" ? idOrKey : (idOrKey?._id || idOrKey?.id || idOrKey?.email || ""));
}

/** Busca por email en local */
export async function findUserByEmail(email: string) {
  await openDatabases();
  try {
    const res = await (localDB as any).find({
      selector: { type: "user", email },
      limit: 1,
    });
    if (res.docs && res.docs[0]) return normalizeUserDocShape(res.docs[0]);
  } catch {}

  const name = email.includes("@") ? email.split("@")[0] : email;
  try { return normalizeUserDocShape(await localDB.get(`user:${name}`)); } catch {}
  try { return normalizeUserDocShape(await localDB.get(`user_${name}`)); } catch {}

  return null;
}

/** Watch de cambios del doc de usuario (replicacion) */
export async function watchUserDocByEmail(
  email: string,
  onUpdate: (doc: any) => void,
): Promise<() => void> {
  await openDatabases();
  if (!localDB) return () => {};

  // Track by slugged keys to match how docs are stored locally (buildUserDocFromData)
  const key = slug(email);
  const ids = [
    `user_${key}`,
    `user:${key}`,
    // Back-compat: also watch username-only key for older docs
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

// ===========================
// Avatar helpers (attachments)
// ===========================
export async function saveUserAvatar(
  email: string,
  blob: Blob,
  contentType: string = blob.type || "image/jpeg",
): Promise<{ ok: true; _id: string; _rev?: string }> {
  await openDatabases();
  if (!localDB) throw new Error("localDB no inicializado");
  const _id = toUserDocId(email);
  let doc: any;
  try { doc = await localDB.get(_id); } catch (e: any) {
    if (e?.status === 404) {
      // crear base minima
      doc = buildUserDocFromData({ _id, id: _id.replace(":", "_"), email });
      try { await localDB.put(sanitizeForCouch(doc)); } catch {}
      doc = await localDB.get(_id);
    } else { throw e; }
  }
  // putAttachment local-first
  const res = await localDB.putAttachment(_id, "avatar", doc._rev, blob, contentType);
  // tambien miniatura 64x64
  try {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = url; });
    URL.revokeObjectURL(url);
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // @ts-ignore
      ctx.imageSmoothingQuality = "high";
      const r = Math.max(size / img.width, size / img.height);
      const dw = img.width * r, dh = img.height * r;
      const dx = (size - dw) / 2, dy = (size - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      let d = "";
      try { d = canvas.toDataURL("image/webp", 0.8); if (!d.startsWith("data:image/webp")) throw new Error(); }
      catch { d = canvas.toDataURL("image/jpeg", 0.8); }
      const thumb = await (await fetch(d)).blob();
      const latest0 = await localDB.get(_id);
      await localDB.putAttachment(_id, "avatar_64", latest0._rev, thumb, thumb.type || "image/jpeg");
    }
  } catch {}
  // marcar bandera y updatedAt
  const latest = await localDB.get(_id);
  latest.hasAvatar = true;
  latest.updatedAt = new Date().toISOString();
  await localDB.put(sanitizeForCouch(latest));

  // Best-effort: subir a remoto si hay internet
  try {
    const online = typeof navigator !== "undefined" && navigator.onLine && remoteDB;
    if (online) {
      let rdoc = await remoteDB.get(_id).catch(() => null);
      if (!rdoc) {
        const base = sanitizeForCouch(latest);
        const put = await remoteDB.put(base);
        rdoc = { ...base, _rev: put.rev };
      }
      const r = await remoteDB.putAttachment(_id, "avatar", rdoc._rev, blob, contentType);
      // tambien miniatura remota
      try {
        const size = 64;
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = url; });
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // @ts-ignore
          ctx.imageSmoothingQuality = "high";
          const r2 = Math.max(size / img.width, size / img.height);
          const dw2 = img.width * r2, dh2 = img.height * r2;
          const dx2 = (size - dw2) / 2, dy2 = (size - dh2) / 2;
          ctx.drawImage(img, dx2, dy2, dw2, dh2);
          let d2 = "";
          try { d2 = canvas.toDataURL("image/webp", 0.8); if (!d2.startsWith("data:image/webp")) throw new Error(); }
          catch { d2 = canvas.toDataURL("image/jpeg", 0.8); }
          const thumb2 = await (await fetch(d2)).blob();
          const rlatest0 = await remoteDB.get(_id);
          await remoteDB.putAttachment(_id, "avatar_64", rlatest0._rev, thumb2, thumb2.type || "image/jpeg");
        }
      } catch {}
      // actualizar doc remoto con bandera por coherencia
      const rlatest = await remoteDB.get(_id);
      rlatest.hasAvatar = true;
      rlatest.updatedAt = new Date().toISOString();
      await remoteDB.put(sanitizeForCouch(rlatest));
    }
  } catch {}

  return { ok: true, _id, _rev: res?.rev };
}


export async function deleteUserAvatar(email: string) {
  await openDatabases();
  const _id = toUserDocId(email);
  try {
    let rev = (await localDB.get(_id))._rev;
    try { const r1 = await localDB.removeAttachment(_id, "avatar", rev); rev = r1.rev; } catch {}
    try { const r2 = await localDB.removeAttachment(_id, "avatar_64", rev); rev = r2.rev; } catch {}
    const latest = await localDB.get(_id);
    latest.hasAvatar = false;
    latest.updatedAt = new Date().toISOString();
    await localDB.put(sanitizeForCouch(latest));
  } catch {}
  try {
    const online = typeof navigator !== "undefined" && navigator.onLine && remoteDB;
    if (online) {
      let rdoc = await remoteDB.get(_id).catch(() => null);
      if (rdoc) {
        let rrev = rdoc._rev;
        try { const rr1 = await remoteDB.removeAttachment(_id, "avatar", rrev); rrev = rr1.rev; } catch {}
        try { const rr2 = await remoteDB.removeAttachment(_id, "avatar_64", rrev); rrev = rr2.rev; } catch {}
        const rlatest = await remoteDB.get(_id);
        rlatest.hasAvatar = false;
        rlatest.updatedAt = new Date().toISOString();
        await remoteDB.put(sanitizeForCouch(rlatest));
      }
    }
  } catch {}
  return { ok: true } as const;
}export async function getUserAvatarBlob(email: string): Promise<Blob | null> {
  await openDatabases();
  if (!localDB) return null;
  const _id = toUserDocId(email);
  try {
    const blob = await localDB.getAttachment(_id, "avatar");
    return blob || null;
  } catch {
    return null;
  }
}

// ===========================
// _users helpers (client-side)
// ===========================
async function upsertRemoteAuthUser({ name, password, roles }: { name?: string; password?: string; roles?: string[] }) {
  const n = (name || "").trim();
  if (!n) return;
  try {
    // Try create; if exists, update.
    if (password) {
      const createRes = await fetch(`/api/admin/couch/users`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: n, password, roles: roles || [] }),
      });
      if (createRes.ok || createRes.status === 201) return;
      if (createRes.status !== 409) return; // other error, give up silently
    }
    // Update roles/password if provided
    await fetch(`/api/admin/couch/users`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: n, password, roles }),
    });
  } catch (e) {
    // ignore, UI already indicates local/remote path
  }
}

// Remove CouchDB _users account for given name/email (best-effort)
async function deleteRemoteAuthUser(name?: string) {
  const n = (name || "").trim();
  if (!n) return;
  try {
    await fetch(`/api/admin/couch/users?name=${encodeURIComponent(n)}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {}
}



// =========================
// ===  PHOTOS (images)  ===
// =========================
type PhotoMeta = {
  owner?: string;
  lat?: number;
  lng?: number;
  tags?: string[];
};

type PhotoDoc = {
  _id: string;
  type: "photo";
  owner?: string;
  createdAt: string;
  lat?: number;
  lng?: number;
  tags?: string[];
  hasOriginal: boolean;
  hasThumb: boolean;
  updatedAt?: string;
};

/** Crea indices para búsqueda de fotos */
async function ensurePhotoIndexes() {
  await openDatabases();
  if (!localDB) return;
  try {
    await (localDB as any).createIndex({
      index: { fields: ["type", "createdAt"] },
      name: "idx-photo-type-createdAt",
    });
  } catch {}
  try {
    await (localDB as any).createIndex({
      index: { fields: ["type", "owner", "createdAt"] },
      name: "idx-photo-owner-createdAt",
    });
  } catch {}
}

/** Genera un id corto aleatorio */
function rid(len = 6) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Redimensiona a un maxSide px y devuelve Blob webp/jpeg según soporte */
async function resizeToBlob(input: Blob, maxSide = 1600, as: "image/webp"|"image/jpeg"="image/jpeg", quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(input);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = url; });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const ratio = Math.min(1, maxSide / Math.max(w, h));
    const cw = Math.round(w * ratio);
    const ch = Math.round(h * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, cw, ch);
    const mime = as;
    const dataUrl = canvas.toDataURL(mime, quality);
    const blob = await (await fetch(dataUrl)).blob();
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Guarda una foto con attachments (original + thumb) en PouchDB (replica a CouchDB) */
export async function savePhoto(file: Blob, meta: PhotoMeta = {}) {
  await openDatabases();
  if (!localDB) throw new Error("DB not ready");
  const nowIso = new Date().toISOString();
  const id = `photo:${nowIso}:${rid(4)}`;

  const doc: PhotoDoc = {
    _id: id,
    type: "photo",
    owner: meta.owner,
    createdAt: nowIso,
    lat: meta.lat, lng: meta.lng, tags: meta.tags || [],
    hasOriginal: true,
    hasThumb: true,
    updatedAt: nowIso,
  };
  // 1) Crear doc base
  try { await (localDB as any).put(sanitizeForCouch(doc)); } catch (e: any) {
    if (e?.status === 409) {
      const existing = await (localDB as any).get(id);
      await (localDB as any).put({ ...existing, ...doc, _rev: existing._rev });
    } else { throw e; }
  }

  // 2) Adjuntar thumb (320px webp)
  const thumb = await resizeToBlob(file, 320, "image/webp", 0.75);
  let latest = await (localDB as any).get(id);
  await (localDB as any).putAttachment(id, "thumb.webp", latest._rev, thumb, "image/webp");

  // 3) Adjuntar original (hasta 1600px para balance tamaño/calidad)
  const original = await resizeToBlob(file, 1600, "image/jpeg", 0.9);
  latest = await (localDB as any).get(id);
  await (localDB as any).putAttachment(id, "original.jpg", latest._rev, original, "image/jpeg");

  // 4) Update metadata
  latest = await (localDB as any).get(id);
  latest.updatedAt = new Date().toISOString();
  await (localDB as any).put(sanitizeForCouch(latest));

  // Best-effort: subir attachments y metadata al remoto si hay internet.  
  // Este bloque intenta replicar inmediatamente los adjuntos a la base remota,  
  // similar a lo que hace saveUserAvatar(). Si no hay conexión, los adjuntos  
  // se sincronizarán automáticamente cuando startSync() esté activo.  
  try {
    const online = typeof navigator !== "undefined" && navigator.onLine && remoteDB;
    if (online) {
      let rdoc: any = null;
      try { rdoc = await remoteDB.get(id); } catch {}
      // Si no existe el doc remoto, crearlo con la metadata actual
      if (!rdoc) {
        try {
          const base = sanitizeForCouch(latest);
          const put = await remoteDB.put(base);
          rdoc = { ...base, _rev: put.rev };
        } catch {}
      }
      if (rdoc) {
        // Subir thumb y original, manejando las revisiones
        try {
          let rr: any = await remoteDB.putAttachment(id, "thumb.webp", rdoc._rev, thumb, "image/webp");
          rr = await remoteDB.putAttachment(id, "original.jpg", rr.rev, original, "image/jpeg");
          // Actualizar flags y updatedAt en remoto
          try {
            const rlatest = await remoteDB.get(id);
            rlatest.hasOriginal = true;
            rlatest.hasThumb = true;
            rlatest.updatedAt = new Date().toISOString();
            await remoteDB.put(sanitizeForCouch(rlatest));
          } catch {}
        } catch {}
      }
    }
  } catch {}

  return { ok: true, _id: id };
}

/** Devuelve Blob del attachment requerido */
export async function getPhotoAttachment(id: string, name: "thumb.webp"|"original.jpg") {
  await openDatabases();
  return await (localDB as any).getAttachment(id, name);
}

/** Devuelve URL de objeto para usar en <img> (recuerda revocar cuando dejes de usarla) */
export async function getPhotoThumbUrl(id: string) {
  const blob = await getPhotoAttachment(id, "thumb.webp");
  return URL.createObjectURL(blob);
}

/** Lista fotos (por owner opcional), ordenadas desc por createdAt */
export async function listPhotos(opts?: { owner?: string; limit?: number; }) {
  await ensurePhotoIndexes();
  const limit = opts?.limit ?? 50;
  const selector: any = { type: "photo" };
  if (opts?.owner) selector.owner = opts.owner;
  const res = await (localDB as any).find({
    selector,
    sort: [{ type: "desc" }, { createdAt: "desc" }],
    limit,
  });
  const docs = (res.docs || []).sort((a:any,b:any)=> String(b.createdAt).localeCompare(String(a.createdAt)));
  return docs as PhotoDoc[];
}

/** Elimina la foto completa */
export async function deletePhoto(id: string) {
  await openDatabases();
  const doc = await (localDB as any).get(id);
  await (localDB as any).remove(doc);
  return { ok: true };
}
