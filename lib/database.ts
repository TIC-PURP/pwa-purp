// lib/database.ts
// Modo offline‑first con PouchDB (local) + CouchDB (remoto)
// - Guarda todo en local cuando no hay internet
// - Cuando hay conexión, sincroniza con CouchDB
// - Login online con BASIC AUTH (evita cookies de terceros bloqueadas)

const isClient: boolean = typeof window !== "undefined"

let PouchDB: any = null
let localDB: any = null
let remoteDB: any = null
let syncHandler: any = null

type CouchEnv = {
  serverBase: string   // ej. https://d2z...cloudfront.net
  serverWithAuth: string // ej. https://user:pass@host
  dbName: string       // ej. gestion_pwa
}

const DEFAULT_REMOTE_DB = (process.env.NEXT_PUBLIC_COUCHDB_DB || "gestion_pwa").trim()

function parseCouchEnv(raw?: string): CouchEnv {
  if (!raw) {
    return { serverBase: "", serverWithAuth: "", dbName: DEFAULT_REMOTE_DB }
  }
  try {
    const url = new URL(raw)
    const path = (url.pathname || "/").replace(/\/+$/, "")
    const envDb = (process.env.NEXT_PUBLIC_COUCHDB_DB || "").trim()
    const dbName =
      path && path !== "/"
        ? path.split("/").filter(Boolean).slice(-1)[0]
        : (envDb || DEFAULT_REMOTE_DB)

    const serverBase = `${url.protocol}//${url.host}`
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
  // Carga PouchDB sólo en cliente
  const PouchCore = require("pouchdb").default || require("pouchdb")
  const PouchFind = require("pouchdb-find").default || require("pouchdb-find")
  PouchCore.plugin(PouchFind)
  PouchDB = PouchCore

  // Base local (persistente en el dispositivo)
  localDB = new PouchDB("gestion_pwa_local")

  // Si la URL ya trae user:pass, inicializa remoto desde el arranque
  const raw = process.env.NEXT_PUBLIC_COUCHDB_URL
  if (raw) {
    try {
      const { serverWithAuth, serverBase, dbName } = parseCouchEnv(raw)
      const baseForPouch = (serverWithAuth || serverBase)
      if (baseForPouch) {
        remoteDB = new PouchDB(`${baseForPouch.replace(/\/$/, "")}/${dbName}`, { skip_setup: false })
      }
    } catch {}
  }
}

import type { User } from "./types"

// ====== Sync ======
export const startSync = () => {
  if (!isClient) return
  if (!localDB || !remoteDB) return
  if (syncHandler) return

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

// ====== Inicializar usuarios por defecto (local) ======
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
        password: "Purp2023@",  // ⚠️ para demo. En prod usa hash (bcryptjs)
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

// ====== Login online (CouchDB) usando BASIC AUTH ======
// IMPORTANTE: el nombre de usuario debe existir en CouchDB.
// Puedes usar el correo como 'name' del usuario CouchDB, o un username simple.
export async function loginOnlineToCouchDB(username: string, password: string): Promise<boolean> {
  try {
    const raw = process.env.NEXT_PUBLIC_COUCHDB_URL
    if (!raw) throw new Error("Falta NEXT_PUBLIC_COUCHDB_URL")

    const { serverBase, dbName } = parseCouchEnv(raw)
    if (!serverBase) throw new Error("URL de CouchDB inválida")

    // Crea remoteDB con BASIC AUTH directamente (evita cookies de terceros)
    if (isClient && PouchDB) {
      const u = new URL(serverBase)
      const authUrl = `${u.protocol}//${encodeURIComponent(username)}:${encodeURIComponent(password)}@${u.host}/${dbName}`
      remoteDB = new PouchDB(authUrl, { skip_setup: false })
    }

    // Verifica credenciales
    await remoteDB?.info()
    return true
  } catch (err) {
    console.error("Error conectando con CouchDB:", err)
    remoteDB = null
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
