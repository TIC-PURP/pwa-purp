// src/lib/database.ts
// Funciones para CouchDB + PouchDB (offline-first) y CRUD de usuarios

const isClient = typeof window !== "undefined"

let PouchDB: any = null
let localDB: any = null
let remoteDB: any = null
let syncHandler: any = null

export type CouchEnv = {
  serverBase: string
  dbName: string
}

/** Lee NEXT_PUBLIC_COUCHDB_URL y devuelve { serverBase, dbName } */
export function getCouchEnv(): CouchEnv {
  const raw = (process.env.NEXT_PUBLIC_COUCHDB_URL || "").trim()
  if (!raw) throw new Error("NEXT_PUBLIC_COUCHDB_URL no está definido")

  const url = new URL(raw)
  const path = url.pathname.replace(/\/+$/, "")
  const parts = path.split("/").filter(Boolean)
  const dbName = parts[parts.length - 1] || "gestion_pwa"

  const serverBase = `${url.protocol}//${url.host}`
  return { serverBase, dbName }
}

/** Carga PouchDB y plugin find */
async function ensurePouch() {
  if (PouchDB) return
  const mod = await import("pouchdb")
  const find = (await import("pouchdb-find")).default
  PouchDB = (mod as any).default || mod
  PouchDB.plugin(find)
}

/** Helpers de IDs para DB particionada (user:clave) y compat con user_ */
function slug(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "-")
}
function toUserDocId(input: string) {
  // Si ya viene con partición, respeta
  if (input.includes(":")) return input
  // Si viene como user_<algo>, conviértelo
  if (input.startsWith("user_")) return `user:${slug(input.slice(5))}`
  // Si viene un email/usuario suelto
  return `user:${slug(input)}`
}
function buildUserDocFromData(data: any) {
  const key = slug(data.email || data.name || data.id || Date.now().toString())
  const _id = `user:${key}`
  const now = new Date().toISOString()
  return {
    _id,
    id: `user_${key}`, // campo informativo para tu UI
    type: "user",
    name: data.name || key,
    email: data.email || "",
    password: data.password || "",
    role: data.role || "user",
    permissions: Array.isArray(data.permissions) ? data.permissions : ["read"],
    isActive: data.isActive !== false,
    createdAt: data.createdAt || now,
    updatedAt: now,
    ...data.extra, // por si pasas campos adicionales
  }
}

/** Abre/crea las bases local y remota */
export async function openDatabases() {
  if (!isClient) return
  await ensurePouch()
  const { serverBase, dbName } = getCouchEnv()

  if (!localDB) {
    localDB = new PouchDB(`${dbName}_local`, { auto_compaction: true })
  }

  if (!remoteDB) {
    const remoteUrl = `${serverBase}/${encodeURIComponent(dbName)}`
    remoteDB = new PouchDB(remoteUrl, {
      skip_setup: true,
      fetch: (url: RequestInfo, opts: any = {}) => {
        opts = opts || {}
        opts.credentials = "include" // usar cookie AuthSession
        return (window as any).fetch(url as any, opts)
      },
      ajax: { withCredentials: true }
    })
  }

  return { localDB, remoteDB }
}

/** Login online contra /_session (name = usuario o email) */
export async function loginOnlineToCouchDB(name: string, password: string) {
  const { serverBase } = getCouchEnv()
  const body = new URLSearchParams({ name, password }).toString()
  const res = await fetch(`${serverBase}/_session`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw new Error(`/_session ${res.status} ${res.statusText} ${txt}`)
  }
  return true
}

/** Cierra la sesión del servidor */
export async function logoutOnlineSession() {
  const { serverBase } = getCouchEnv()
  try {
    await fetch(`${serverBase}/_session`, { method: "DELETE", credentials: "include" })
  } catch {}
}

/** Arranca replicación continua */
export async function startSync() {
  if (!isClient) return
  await openDatabases()
  if (!localDB || !remoteDB) return

  if (syncHandler && syncHandler.cancel) return syncHandler

  const { serverBase } = getCouchEnv()
  const viaCloudFront = /cloudfront\.net$/i.test(new URL(serverBase).host)
  const opts: any = { live: true, retry: true }
  if (viaCloudFront) {
    // supervivencia detrás de CloudFront
    opts.heartbeat = 25000
    opts.timeout = 55000
  }

  syncHandler = localDB.sync(remoteDB, opts)
  syncHandler
    .on("change", (i: any) => console.log("[sync] change", i.direction))
    .on("paused", (e: any) => console.log("[sync] paused", e?.message || "ok"))
    .on("active", () => console.log("[sync] active"))
    .on("error", (e: any) => console.error("[sync] error", e))
  return syncHandler
}

/** Detiene replicación */
export async function stopSync() {
  if (syncHandler?.cancel) {
    try {
      await syncHandler.cancel()
    } catch {}
  }
  syncHandler = null
}

/** Login offline contra Pouch local */
export async function authenticateUser(identifier: string, password: string) {
  await openDatabases()
  if (!localDB) return null

  const candidates = [
    `user_${identifier}`,
    identifier.includes("@") ? `user_${identifier.split("@")[0]}` : null,
  ].filter(Boolean)

  // Buscar por "id" en docs (no por _id) para compatibilidad
  try {
    await localDB.createIndex({ index: { fields: ["id"] }, name: "idx-id" })
  } catch {}
  for (const cand of candidates as string[]) {
    const r = await localDB.find({ selector: { id: cand as string } })
    if (r.docs?.[0] && r.docs[0].password === password) return r.docs[0]
  }
  return null
}

/** Guarda/actualiza usuario en Pouch local */
export async function guardarUsuarioOffline(user: any) {
  await openDatabases()
  if (!localDB) throw new Error("localDB no inicializado")

  // Normaliza a doc con partición user:
  const key = slug(user.email || user.name || user.id || "")
  const _id = `user:${key}`
  const toSave = {
    ...buildUserDocFromData(user),
    _id,
    id: `user_${key}`,
    updatedAt: new Date().toISOString(),
  }

  try {
    const existing = await localDB.get(_id)
    toSave._rev = existing._rev
    await localDB.put(toSave)
  } catch (err: any) {
    if (err?.status === 404) {
      await localDB.put(toSave)
    } else {
      console.error("guardarUsuarioOffline", err)
      throw err
    }
  }
}

/** Semilla local por si entras offline la primera vez */
export async function initializeDefaultUsers() {
  await openDatabases()
  if (!localDB) return
  const now = new Date().toISOString()
  const def = buildUserDocFromData({
    name: "Mario Acosta",
    email: "mario_acosta@purp.com.mx",
    password: "Purp_*2023@",
    role: "manager",
    permissions: ["read", "write", "delete", "manage_users"],
    createdAt: now,
  })
  try {
    await localDB.get(def._id)
  } catch (e: any) {
    if (e?.status === 404) await localDB.put(def)
  }
}

/* ============================
   ==========  USERS  =========
   ============================
   CRUD que usa la base local (offline-first); la sync se encarga del remoto.
*/

async function ensureUserIndexes() {
  await openDatabases()
  if (!localDB) return
  try {
    await localDB.createIndex({
      index: { fields: ["type", "updatedAt"] },
      name: "idx-type-updatedAt",
    })
  } catch {}
  try {
    await localDB.createIndex({
      index: { fields: ["email"] },
      name: "idx-email",
    })
  } catch {}
}

/** Lista usuarios (activos por defecto). `opts.includeInactive=true` para traer todos */
export async function getAllUsers(opts?: { includeInactive?: boolean; limit?: number }) {
  await openDatabases()
  await ensureUserIndexes()
  const includeInactive = Boolean(opts?.includeInactive)
  const limit = opts?.limit ?? 1000

  // Intento con Mango
  try {
    const selector: any = { type: "user" }
    if (!includeInactive) selector.isActive = { $ne: false }
    const r = await localDB.find({
      selector,
      sort: [{ updatedAt: "desc" }],
      limit,
    })
    return r.docs || []
  } catch (e: any) {
    // Fallback por prefix en _id (dos variantes)
    const resA = await localDB.allDocs({
      include_docs: true,
      startkey: "user:",
      endkey: "user;\ufff0",
      limit,
    })
    const resB = await localDB.allDocs({
      include_docs: true,
      startkey: "user_",
      endkey: "user_\ufff0",
      limit,
    })
    const docs = [...resA.rows, ...resB.rows]
      .map((r: any) => r.doc)
      .filter(Boolean)
      .filter((d: any) => (includeInactive ? d.type === "user" : d.type === "user" && d.isActive !== false))
    // Orden por updatedAt desc
    docs.sort((a: any, b: any) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    return docs
  }
}

/** Crea usuario (o lo upserta si ya existe) */
export async function createUser(data: any) {
  await openDatabases()
  const doc = buildUserDocFromData(data)
  try {
    const existing = await localDB.get(doc._id)
    doc._rev = existing._rev
    // si ya existe, solo actualiza campos
    doc.createdAt = existing.createdAt || doc.createdAt
  } catch (e: any) {
    // no existe, seguimos
  }
  await localDB.put(doc)
  return doc
}

/** Obtiene un usuario por ID (acepta user:xxx o user_xxx o email/usuario) */
export async function getUserById(idOrKey: string) {
  await openDatabases()
  const _id = toUserDocId(idOrKey)
  try {
    return await localDB.get(_id)
  } catch (e: any) {
    if (e?.status === 404) return null
    throw e
  }
}

/** Actualiza un usuario.
 *  Soporta dos formas:
 *   - updateUser(idOrKey, patch)
 *   - updateUser(patchObject)  ← esta es la que usa tu UI en page.tsx
 *
 *  idOrKey/patchObject pueden ser: user:xxx | user_xxx | email | usuario | objeto con _id/id/email/name
 */
export async function updateUser(idOrPatch: any, maybePatch?: any) {
  await openDatabases()
  if (!localDB) throw new Error("localDB no inicializado")

  let _id: string
  let patch: any

  if (typeof maybePatch === "undefined") {
    // Forma: updateUser(patchObject)
    const obj = idOrPatch || {}
    const key =
      obj._id ||
      obj.id ||
      obj.email ||
      obj.name

    if (!key) throw new Error("updateUser: falta identificador (_id | id | email | name)")

    _id = toUserDocId(typeof key === "string" ? key : String(key))
    patch = { ...obj } // mergearemos sobre el doc existente
  } else {
    // Forma: updateUser(idOrKey, patch)
    _id = toUserDocId(idOrPatch)
    patch = { ...maybePatch }
  }

  // No permitir que cambien _id/_rev de forma inválida
  delete patch._id

  const doc = await localDB.get(_id)
  const updated = {
    ...doc,
    ...patch,
    _id,
    _rev: doc._rev,
    type: "user",
    updatedAt: new Date().toISOString(),
  }
  await localDB.put(updated)
  return updated
}

/** Borrado lógico (isActive:false) */
export async function softDeleteUser(idOrKey: string) {
  await openDatabases()
  const _id = toUserDocId(idOrKey)
  const doc = await localDB.get(_id)
  doc.isActive = false
  doc.updatedAt = new Date().toISOString()
  doc.deletedAt = doc.updatedAt
  await localDB.put(doc)
  return doc
}

/** Restaura usuario (isActive:true) */
export async function restoreUser(idOrKey: string) {
  await openDatabases()
  const _id = toUserDocId(idOrKey)
  const doc = await localDB.get(_id)
  doc.isActive = true
  doc.updatedAt = new Date().toISOString()
  delete doc.deletedAt
  await localDB.put(doc)
  return doc
}

/** Borrado permanente (hard delete) por id/clave.
 *  Acepta: user:xxx | user_xxx | email | usuario
 */
export async function deleteUserById(idOrKey: string): Promise<boolean> {
  await openDatabases()
  const _id = toUserDocId(idOrKey)
  try {
    const doc = await localDB.get(_id)
    await localDB.remove(doc) // elimina del local; la sync lo replica al remoto
    return true
  } catch (e: any) {
    if (e?.status === 404) return false
    throw e
  }
}

/** Alias por si alguna parte del código lo llama así */
export async function hardDeleteUser(idOrKey: string): Promise<boolean> {
  return deleteUserById(idOrKey)
}

export async function findUserByEmail(email: string) {
  await openDatabases();
  // 1) intenta por el _id que usa la PWA
  const idByEmail = `user_${email}`;
  try {
    const doc = await localDB.get(idByEmail);
    return doc as any;
  } catch {}

  // 2) intenta por Mango (type + email)
  try {
    const res = await (localDB as any).find({
      selector: { type: "user", email },
      limit: 1,
    });
    if (res.docs && res.docs[0]) return res.docs[0];
  } catch {}

  // 3) intenta por name (user:mario_acosta)
  const name = email.includes("@") ? email.split("@")[0] : email;
  try {
    const doc = await localDB.get(`user:${name}`);
    return doc as any;
  } catch {}

  return null;
}

export { localDB, remoteDB }
