// Solo ejecutar en cliente
const isClient = typeof window !== "undefined"

let PouchDB: any = null
let localDB: PouchDB.Database | null = null
let remoteDB: PouchDB.Database | null = null

if (isClient) {
  const PouchCore = require("pouchdb").default
  const PouchFind = require("pouchdb-find").default
  PouchCore.plugin(PouchFind)
  PouchDB = PouchCore

  localDB = new PouchDB("gestion_pwa_local")
  if (process.env.NEXT_PUBLIC_COUCHDB_URL) {
    remoteDB = new PouchDB(`${process.env.NEXT_PUBLIC_COUCHDB_URL}/gestion_pwa`)
  }
}

import type { User } from "./types"

let syncHandler: any = null

export const startSync = () => {
  console.log("📡 startSync llamado")

  if (!isClient) {
    console.warn("No está en cliente")
    return
  }

  if (!localDB) {
    console.warn("localDB no está disponible")
    return
  }

  if (!remoteDB) {
    console.warn("CouchDB remoto no disponible")
    return
  }

  if (syncHandler) {
    console.warn("Ya hay un sync activo")
    return
  }

  syncHandler = localDB.sync(remoteDB, {
    live: true,
    retry: true,
  })
    .on("change", (info) => console.log("Sync change:", info))
    .on("paused", () => console.log("Sync paused"))
    .on("active", () => console.log("Sync active"))
    .on("denied", (err) => console.error("Sync denied:", err))
    .on("complete", (info) => console.log("Sync complete:", info))
    .on("error", (err) => console.error("Sync error:", err))
}


export const stopSync = () => {
  if (syncHandler) {
    syncHandler.cancel()
    syncHandler = null
  }
}

export const initializeDefaultUsers = async (): Promise<void> => {
  if (!localDB) return
  try {
    const result = await localDB.find({ selector: { id: { $regex: "^user_" } } })
    if (result.docs.length === 0) {
      await localDB.put({
        _id: `user_${Date.now()}`,
        id: `user_${Date.now()}`,
        name: "Manager",
        email: "manager@purp.com.mx",
        password: "Purp2023@",
        role: "manager",
        permissions: ["read", "write", "delete", "manage_users"],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error("Error inicializando usuarios por defecto:", error)
  }
}

export { localDB, remoteDB }

export const getAllUsers = async (): Promise<User[]> => {
  if (!localDB) return []
  const result = await localDB.find({ selector: { id: { $regex: "^user_" } } })
  return result.docs as User[]
}

export const createUser = async (user: User): Promise<void> => {
  if (!localDB) return
  const _id = `user_${Date.now()}`
  await localDB.put({ ...user, _id, id: _id })
}

export const updateUser = async (user: User): Promise<void> => {
  if (!localDB || !user._id) return

  const existing = await localDB.get(user._id) as User

  // Si la nueva contraseña está vacía o no se proporcionó, no la sobrescribas
  const passwordToSave = user.password?.trim()
    ? user.password
    : existing.password

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
  const user = await localDB.get(_id) as User
  user.isActive = false
  user.updatedAt = new Date().toISOString()
  await localDB.put(user)
}

export const authenticateUser = async (email: string, password: string): Promise<User | null> => {
  if (!localDB) return null

  try {
    await localDB.createIndex({
      index: { fields: ["email", "password", "isActive"] }
    })

    const result = await localDB.find({
      selector: { email, password, isActive: true },
      limit: 1
    })

    return result.docs[0] as User || null

  } catch (err) {
    console.error("Error autenticando usuario:", err)
    return null
  }
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
