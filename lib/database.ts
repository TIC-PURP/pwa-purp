// lib/database.ts

// Solo ejecutar en cliente
const isClient = typeof window !== "undefined"

let PouchDB: any = null
let localDB: PouchDB.Database | null = null
let remoteDB: PouchDB.Database | null = null
let syncHandler: any = null

type CouchEnv = {
  serverBase: string
  serverWithAuth: string
  dbName: string
}

const DEFAULT_REMOTE_DB = "gestion_pwa" // cámbiala si tu DB remota se llama distinto

function parseCouchEnv(raw?: string): CouchEnv {
  if (!raw) {
    return { serverBase: "", serverWithAuth: "", dbName: DEFAULT_REMOTE_DB }
  }
  try {
    // Soporta ruta relativa (p. ej. /api/couch/gestion_pwa)
    if (raw.startsWith('/')) {
      const parts = raw.split('/').filter(Boolean)
      const dbName = parts.length ? parts[parts.length - 1] : DEFAULT_REMOTE_DB
      const base = (typeof window !== 'undefined' ? window.location.origin : '')
      return { serverBase: base, serverWithAuth: base, dbName }
    }
    // URL absoluta
    const url = new URL(raw)
    const path = (url.pathname || "/").replace(/\/+\$/, "")
    const envDb = process.env.NEXT_PUBLIC_COUCHDB_DB?.trim()
    const dbName =
      path && path !== "/"
        ? path.split("/").filter(Boolean).slice(-1)[0]
        : (envDb || DEFAULT_REMOTE_DB)

    const serverBase = `${url.protocol}//${url.host}`

    // Conserva user:pass si vinieran en la URL
    const authPrefix =
      (url.username ? decodeURIComponent(url.username) : "") +
      (url.password ? ":" + decodeURIComponent(url.password) : "")
    const authAt = authPrefix ? `${authPrefix}@` : ""
    const serverWithAuth = `${url.protocol}//${authAt}${url.host}`

    return { serverBase, serverWithAuth, dbName }
  } catch {
    return { serverBase: "", serverWithAuth: "", dbName: DEFAULT_REMOTE_DB }
  }
}
  }

  try {
    const url = new URL(raw)
    const path = (url.pathname || "/").replace(/\/+$/, "")
    const envDb = process.env.NEXT_PUBLIC_COUCHDB_DB?.trim()
    const dbName =
      path && path !== "/"
        ? path.split("/").filter(Boolean).slice(-1)[0]
        : (envDb || DEFAULT_REMOTE_DB)

    const serverBase = `${url.protocol}//${url.host}`

    // Conserva user:pass si vinieran en la URL
    const authPrefix =
      (url.username ? decodeURIComponent(url.username) : "") +
      (url.password ? ":" + decodeURIComponent(url.password) : "")
    const authAt = authPrefix ? `${authPrefix}@` : ""
    const serverWithAuth = `${url.protocol}//${authAt}${url.host}`

    return { serverBase, serverWithAuth, dbName }
  } catch {
    return { serverBase: "", serverWithAuth: "", dbName: DEFAULT_REMOTE_DB }
  }
}

if (isClient) {
  const PouchCore = require("pouchdb").default
  const PouchFind = require("pouchdb-find").default
  PouchCore.plugin(PouchFind)
  PouchDB = PouchCore

  // Local
  localDB = new PouchDB("gestion_pwa_local")

  // Remoto (opcional al arranque; si usas _session por cookies, se re-crea en login)
  if (process.env.NEXT_PUBLIC_COUCHDB_URL) {
    try {
      const { serverWithAuth, serverBase, dbName } = parseCouchEnv(process.env.NEXT_PUBLIC_COUCHDB_URL)
      const baseForPouch = (serverWithAuth || serverBase)
      if (baseForPouch) {
        remoteDB = new PouchDB(`${baseForPouch.replace(/\/$/, "")}/${dbName}`)
      }
    } catch {
      /* noop: se construirá en login */
    }
  }
}

import type { User } from "./types"

// ====== Sync ======
export const startSync = () => {
  if (!isClient) {
    console.warn("startSync: No está en cliente")
    return
  }
  if (!localDB) {
    console.warn("startSync: localDB no disponible")
    return
  }
  if (!remoteDB) {
    console.warn("startSync: CouchDB remoto no disponible")
    return
  }
  if (syncHandler) {
    console.warn("startSync: Ya hay un sync activo")
    return
  }

  syncHandler = (PouchDB as any)
    .sync(localDB, remoteDB, { live: true, retry: true })
    .on("change", (info: any) => console.log("Sync change:", info))
    .on("paused", () => console.log("Sync paused"))
    .on("active", () => console.log("Sync active"))
    .on("denied", (err: any) => console.error("Sync denied:", err))
    .on("complete", (info: any) => console.log("Sync complete:", info))
    .on("error", (err: any) => console.error("Sync error:", err))
}

export const stopSync = () => {
  if (syncHandler?.cancel) {
    syncHandler.cancel()
  }
  syncHandler = null
}

// ====== Inicializar usuarios por defecto (solo local) ======
export const initializeDefaultUsers = async (): Promise<void> => {
  if (!localDB) return
  try {
    await localDB.createIndex({ index: { fields: ["id"] } })
    const result = await localDB.find({ selector: { id: { $regex: "^user_" } } })
    if (result.docs.length === 0) {
      const now = new Date().toISOString()
      await localDB.put({
        _id: `user_${Date.now()}`,
        id: `user_${Date.now()}`,
        name: "Manager",
        email: "manager@purp.com.mx",
        password: "Purp2023@", // ⚠️ Recomendación: migrar a hash (bcryptjs)
        role: "manager",
        permissions: ["read", "write", "delete", "manage_users"],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
    }
  } catch (error) {
    console.error("Error inicializando usuarios por defecto:", error)
  }
}

// ====== CRUD Usuarios (local) ======
export const getAllUsers = async (): Promise<User[]> => {
  if (!localDB) return []
  await localDB.createIndex({ index: { fields: ["id"] } })
  const result = await localDB.find({ selector: { id: { $regex: "^user_" } } })
  return result.docs as User[]
}

export const createUser = async (user: User): Promise<void> => {
  if (!localDB) return
  const _id = `user_${Date.now()}`
  await localDB.put({ ...user, _id, id: _id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
}

export const updateUser = async (user: User): Promise<void> => {
  if (!localDB || !user._id) return
  const existing = (await localDB.get(user._id)) as User

  const passwordToSave = user.password?.trim() ? user.password : existing.password

  const updatedUser = {
    ...existing,
    ...user,
    password: passwordToSave,
    updatedAt: new Date().toISOString(),
  }
  await localDB.put(updatedUser)
}

export const softDeleteUser = async (_id: string): Promise<void> => {
  if (!localDB) return
  const user = (await localDB.get(_id)) as User
  user.isActive = false
  user.updatedAt = new Date().toISOString()
  await localDB.put(user)
}

export const deleteUserById = async (userId: string): Promise<void> => {
  if (!localDB) return
  try {
    const user = await localDB.get(userId)
    await localDB.remove(user)
  } catch (error) {
    console.error("Error al eliminar usuario:", error)
  }
}

export const updateUserById = async (userId: string, updates: Partial<User>): Promise<void> => {
  if (!localDB) return
  try {
    const user = await localDB.get(userId)
    const updatedUser = { ...user, ...updates, updatedAt: new Date().toISOString() }
    await localDB.put(updatedUser)
  } catch (error) {
    console.error("Error al actualizar usuario:", error)
  }
}

// ====== Autenticación offline (local) ======
export const authenticateUser = async (email: string, password: string): Promise<User | null> => {
  if (!localDB) return null
  try {
    await localDB.createIndex({ index: { fields: ["email", "password", "isActive"] } })
    const result = await localDB.find({
      selector: { email, password, isActive: true },
      limit: 1,
    })
    return (result.docs[0] as User) || null
  } catch (err) {
    console.error("Error autenticando usuario:", err)
    return null
  }
}

// ====== Login online (CouchDB _session) ======
export async function loginOnlineToCouchDB(email: string, password: string): Promise<boolean> {
  try {
    const raw = process.env.NEXT_PUBLIC_COUCHDB_URL
    if (!raw) throw new Error("Falta NEXT_PUBLIC_COUCHDB_URL")

    const { serverBase, dbName } = parseCouchEnv(raw)
    if (!serverBase) throw new Error("URL de CouchDB inválida")

    // 1) Sesión por cookie
    const sessionUrl = `${serverBase}/_session`
    const res = await fetch(sessionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: email, password }),
      credentials: "include",
    })
    if (!res.ok) return false

    // 2) Re-crear remoteDB para usar cookies
    if (isClient && PouchDB) {
      remoteDB = new PouchDB(`${serverBase}/${dbName}`, {
        fetch: (url: string, opts: any = {}) =>
          fetch(url, { ...opts, credentials: "include" }),
      })
    }

    await remoteDB?.info()
    return true
  } catch (err) {
    console.error("Error conectando con CouchDB:", err)
    return false
  }
}

// ====== Guardar usuario offline con _id estable ======
export const guardarUsuarioOffline = async (user: any) => {
  if (!localDB) return
  const _id = `user_${user.username || user.email}`
  try {
    const existing = await localDB.get(_id)
    user._rev = (existing as any)._rev
    await localDB.put({ _id, ...user })
  } catch (err: any) {
    if (err?.status === 404) {
      await localDB.put({ _id, ...user })
    } else {
      console.error("Error guardando usuario offline:", err)
    }
  }
}

export { localDB, remoteDB }
