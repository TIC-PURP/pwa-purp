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
    modulePermissions: (typeof data.modulePermissions === "object" && !Array.isArray(data.modulePermissions))
      ? data.modulePermissions
      : (!Array.isArray(data.permissions) && typeof data.permissions === "object" ? (data.permissions as any) : { MOD_A: "NONE" }),
    isActive: data.isActive !== false,
    createdAt: data.createdAt || now,
    updatedAt: now,
    ...data.extra,
  };
}

// Elimina campos reservados no permitidos por CouchDB (claves que empiezan por "_"
// excepto las reconocidas). Evita errores de validación como
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
  try {
    // Evitar cuelgues: no esperar a que cancel() resuelva
    // Algunos adaptadores de PouchDB no devuelven una Promise resoluble aquí
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
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  console.log("[db] loginOnlineToCouchDB response", res.status, data);
  // Mejor manejo de errores: si el API devolvió error, propagar mensaje claro
  if (!res.ok || !data?.ok) {
    const msg = (data && (data.error || data.reason)) || res.statusText || "login failed";
    throw new Error(String(msg));
  }
  // Devolvemos los datos para usar roles en el cliente
  return data as any; // { ok: boolean, user?: string, roles?: string[] }
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
  if (!localDB) throw new Error("localDB no inicializado");

  // 1) Intentar match exacto por email (más robusto)
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
 * Lista cuentas de CouchDB /_users vía API admin (solo manager/admin).
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

    // Traer también lo local para fusionar metadatos si existen
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
        ? { MOD_A: "FULL" }
        : (local && local.modulePermissions && typeof local.modulePermissions === "object" && !Array.isArray(local.modulePermissions))
          ? local.modulePermissions
          : { MOD_A: "NONE" };
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
  if (!mp || Array.isArray(mp) || typeof mp !== "object") {
    // Si permissions venía como objeto v2 (raro), intentar usarlo; si no, valor por defecto
    out.modulePermissions = (!Array.isArray(u.permissions) && typeof u.permissions === "object" && u.permissions)
      ? { MOD_A: (u.permissions as any).MOD_A || "NONE", ...(u.permissions as any) }
      : { MOD_A: "NONE" };
  }
  return out;
}

/** Limpia campos inválidos (como ___writePath) de documentos de usuario existentes */
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

/** Crea (o upserta) usuario — LOCAL FIRST */
export async function createUser(data: any) {
  await openDatabases();
  const doc = buildUserDocFromData(data);
  const online = typeof navigator !== "undefined" && navigator.onLine && remoteDB;

  if (online) {
    try {
      const toRemote = sanitizeForCouch(doc);
      const res = await remoteDB.put(toRemote);
      doc._rev = res.rev;
      try { await localDB.put(sanitizeForCouch(doc)); } catch {}
      // Best-effort: also create a CouchDB _users account so the user can login online
      try {
        const roles = [doc.role].filter(Boolean) as string[];
        await upsertRemoteAuthUser({ name: doc.email || doc.name, password: doc.password, roles });
      } catch (e) { console.warn("[createUser] _users upsert failed", (e as any)?.message || e); }
      return { ...doc, ___writePath: "remote" } as any;
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
  await localDB.put(toLocal); // LOCAL ONLY. La replicación lo sube.
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
  // No sobreescribir password con cadena vacía desde el formulario de edición
  if (typeof patch.password === "string" && patch.password.trim() === "") {
    delete patch.password;
  }

  const doc = await localDB.get(_id);
  const updated = {
    ...doc,
    ...patch,
    // v2: soportar modulePermissions y permisos estilo objeto (MOD_A: FULL|READ|NONE)
    ...(patch.modulePermissions && typeof patch.modulePermissions === "object"
        ? { modulePermissions: { ...(doc.modulePermissions || {}), ...patch.modulePermissions } } : {}),
    ...(patch.permissions && !Array.isArray(patch.permissions) && typeof patch.permissions === "object"
        ? { modulePermissions: { ...(doc.modulePermissions || {}), ...(patch.permissions as any) } } : {}),
    
    _id,
    _rev: doc._rev,
    type: "user",
    updatedAt: new Date().toISOString(),
  };
  // Asegurar forma correcta: si patch.permissions venía como objeto (v2), no sobreescribir el array
  if (updated.permissions && !Array.isArray(updated.permissions)) {
    updated.permissions = Array.isArray(doc.permissions) ? doc.permissions : [];
  }
  const wasActive = doc.isActive !== false;
  const isNowActive = updated.isActive !== false;
  const oldName = (doc.email || doc.name || "").trim();
  const newName = (updated.email || updated.name || "").trim();
  const nameChanged = oldName && newName && oldName !== newName;
  const online = typeof navigator !== "undefined" && navigator.onLine && remoteDB;
  if (online) {
    try {
      const toRemote = sanitizeForCouch(updated);
      const res = await remoteDB.put(toRemote);
      updated._rev = res.rev;
      try { await localDB.put(sanitizeForCouch(updated)); } catch {}
      // Best-effort: sync CouchDB _users according to status and identity changes
      try {
        const roles = [updated.role].filter(Boolean) as string[];
        if (wasActive !== isNowActive) {
          // Status changed
          if (!isNowActive) {
            // Deactivated: remove auth account
            await deleteRemoteAuthUser(oldName || newName);
          } else {
            // Activated: ensure auth account exists with current identity and password
            if (nameChanged) {
              await deleteRemoteAuthUser(oldName);
            }
            await upsertRemoteAuthUser({ name: newName, password: updated.password, roles });
          }
        } else {
          // Status unchanged
          if (isNowActive) {
            // Only sync auth account when active
            if (nameChanged) {
              await deleteRemoteAuthUser(oldName);
            }
            await upsertRemoteAuthUser({ name: newName, password: patch.password, roles });
          }
        }
      } catch (e) { console.warn("[updateUser] _users auth sync failed", (e as any)?.message || e); }
      return { ...sanitizeForCouch(updated), ___writePath: "remote" } as any;
    } catch (err) {
      if ((err as any)?.status === 409) {
        try {
          const latest = await remoteDB.get(_id);
          const merged = {
            ...latest,
            ...patch,
            _id,
            _rev: latest._rev,
            type: "user",
            updatedAt: new Date().toISOString(),
          } as any;
          if (merged.permissions && !Array.isArray(merged.permissions)) {
            merged.permissions = Array.isArray(latest.permissions) ? latest.permissions : [];
          }
          const res2 = await remoteDB.put(sanitizeForCouch(merged));
          merged._rev = res2.rev;
          try { await localDB.put(sanitizeForCouch(merged)); } catch {}
          try {
            const roles = [merged.role].filter(Boolean) as string[];
            const wasActive2 = (latest.isActive !== false);
            const isNowActive2 = (merged.isActive !== false);
            const oldName2 = (latest.email || latest.name || "").trim();
            const newName2 = (merged.email || merged.name || "").trim();
            const nameChanged2 = oldName2 && newName2 && oldName2 !== newName2;
            if (wasActive2 !== isNowActive2) {
              if (!isNowActive2) {
                await deleteRemoteAuthUser(oldName2 || newName2);
              } else {
                if (nameChanged2) await deleteRemoteAuthUser(oldName2);
                await upsertRemoteAuthUser({ name: newName2, password: merged.password, roles });
              }
            } else if (isNowActive2) {
              if (nameChanged2) await deleteRemoteAuthUser(oldName2);
              await upsertRemoteAuthUser({ name: newName2, password: patch.password, roles });
            }
          } catch (e) { console.warn("[updateUser] _users auth sync (retry) failed", (e as any)?.message || e); }
          return { ...sanitizeForCouch(merged), ___writePath: "remote" } as any;
        } catch (e2) {
          console.warn("[updateUser] 409 retry failed, falling back to local", e2);
        }
      }
      console.warn("[updateUser] remote put failed, falling back to local", err);
    }
  }
  const toLocal = sanitizeForCouch(updated);
  await localDB.put(toLocal); // LOCAL ONLY
  return { ...toLocal, ___writePath: "local" } as any;
}

/** Borrado lógico — LOCAL FIRST */
export async function softDeleteUser(idOrKey: string) {
  await openDatabases();
  const _id = toUserDocId(idOrKey);
  const doc = await localDB.get(_id);
  doc.isActive = false;
  doc.updatedAt = new Date().toISOString();
  doc.deletedAt = doc.updatedAt;
  await localDB.put(sanitizeForCouch(doc)); // << LOCAL ONLY
  try {
    const online = typeof navigator !== "undefined" && navigator.onLine;
    if (online) await deleteRemoteAuthUser(doc.email || doc.name);
  } catch {}
  return sanitizeForCouch(doc);
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

/** Alias para realizar borrado permanente */
export async function hardDeleteUser(idOrKey: string): Promise<boolean> {
  // Best-effort: remove CouchDB _users account before deleting local doc
  try {
    await openDatabases();
    const online = typeof navigator !== "undefined" && navigator.onLine;
    if (online) {
      try {
        const _id = toUserDocId(idOrKey);
        const doc = await localDB.get(_id);
        const email = (doc && (doc.email || doc.name)) || "";
        if (email) {
          await fetch(`/api/admin/couch/users?name=${encodeURIComponent(email)}`, {
            method: "DELETE",
            credentials: "include",
          });
        }
      } catch {}
    }
  } catch {}
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
