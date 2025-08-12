// lib/database.ts

// Solo ejecutar en cliente
const isClient = typeof window !== "undefined"

let PouchDB: any = null
let localDB: PouchDB.Database | null = null
let remoteDB: PouchDB.Database | null = null
let syncHandler: any = null

type CouchEnv = { serverBase: string; dbName: string }

const DEFAULT_REMOTE_DB = "gestion_pwa"

function parseCouchEnv(raw?: string): CouchEnv {
  if (!raw) return { serverBase: "", dbName: DEFAULT_REMOTE_DB }
  try {
    const url = new URL(raw)
    const path = (url.pathname || "/").replace(/\/+$/, "")
    const dbName =
      path && path !== "/"
        ? path.split("/").filter(Boolean).slice(-1)[0]
        : DEFAULT_REMOTE_DB
    const serverBase = `${url.protocol}//${url.host}` // sin credenciales
    return { serverBase, dbName }
  } catch {
    return { serverBase: "", dbName: DEFAULT_REMOTE_DB }
  }
}

const COUCH_URL = process.env.NEXT_PUBLIC_COUCHDB_URL || ""
const COUCH_USER = process.env.NEXT_PUBLIC_COUCHDB_USER || ""
const COUCH_PASS = process.env.NEXT_PUBLIC_COUCHDB_PASS || ""

function buildAuthHeader() {
  if (!isClient || !COUCH_USER || !COUCH_PASS) return undefined
  return "Basic " + btoa(`${COUCH_USER}:${COUCH_PASS}`)
}

function createRemoteWithAuth(base: string, dbName: string) {
  const auth = buildAuthHeader()
  return new (PouchDB as any)(`${base.replace(/\/$/, "")}/${dbName}`, {
    fetch: (url: any, opts: any = {}) => {
      if (auth) {
        opts.headers = { ...(opts.headers || {}), Authorization: auth }
      }
      return fetch(url, opts)
    },
  })
}

if (isClient) {
  const PouchCore = require("pouchdb").default
  const PouchFind = require("pouchdb-find").default
  PouchCore.plugin(PouchFind)
  PouchDB = PouchCore

  // Local
  localDB = new PouchDB("gestion_pwa_local")

  // Remoto (si hay URL)
  if (COUCH_URL) {
    const { serverBase, dbName } = parseCouchEnv(COUCH_URL)
    if (serverBase) {
      remoteDB = createRemoteWithAuth(serverBase, dbName)
    }
  }
}

import type { User } from "./types"

// ====== Sync ======
export const startSync = () => {
  if (!isClient) return console.warn("startSync: No está en cliente")
  if (!localDB) return console.warn("startSync: localDB no disponible")
  if (!remoteDB) return console.warn("startSync: CouchDB remoto no disponible")
  if (syncHandler) return console.warn("startSync: Ya hay un sync activo")

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
  if (syncHandler?.cancel) syncHandler.cancel()
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
        password: "Purp2023@", // TODO: migrar a hash (bcryptjs)
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
  const updatedUser = { ...existing, ...user, password: passwordToSave, updatedAt: new Date().toISOString() }
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
    const result = await localDB.find({ selector: { email, password, isActive: true }, limit: 1 })
    return (result.docs[0] as User) || null
  } catch (err) {
    console.error("Error autenticando usuario:", err)
    return null
  }
}

// ====== Login online ======
// Si hay COUCH_USER/PASS -> usa Basic Auth por header (sin cookies)
// Si NO hay -> intenta _session (cookies) para same-origin
export async function loginOnlineToCouchDB(email: string, password: string): Promise<boolean> {
  try {
    const { serverBase, dbName } = parseCouchEnv(COUCH_URL)
    if (!serverBase) throw new Error("Falta NEXT_PUBLIC_COUCHDB_URL")

    if (COUCH_USER && COUCH_PASS) {
      if (isClient && PouchDB) remoteDB = createRemoteWithAuth(serverBase, dbName)
      await remoteDB?.info()
      return true
    }

    // Fallback: sesión por cookies (_session)
    const sessionUrl = `${serverBase}/_session`
    const res = await fetch(sessionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ name: email, password }),
      credentials: "include",
    })
    if (!res.ok) return false

    if (isClient && PouchDB) {
      remoteDB = new PouchDB(`${serverBase}/${dbName}`, {
        fetch: (url: string, opts: any = {}) => fetch(url, { ...opts, credentials: "include" }),
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
export const guardarUsuarioOffline = async (user: Partial<User> & { username?: string; email?: string }) => {
  if (!localDB) return
  const key = (user.username || user.email || '').toString().trim() || Date.now().toString()
  const _id = `user_${key}`

  try {
    const existing: any = await localDB.get(_id)
    await localDB.put({
      ...existing,
      ...user,
      _id,
      _rev: existing._rev,
      updatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    if (err?.status === 404) {
      await localDB.put({
        _id,
        ...user,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } else {
      console.error("Error guardando usuario offline:", err)
      throw err
    }
  }
}

export { localDB, remoteDB }
