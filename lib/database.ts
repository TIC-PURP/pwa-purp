// lib/database.ts
import PouchDB from "pouchdb-browser"
import PouchFind from "pouchdb-find"
import type { User } from "@/lib/types"

PouchDB.plugin(PouchFind)

const COUCH_URL = process.env.NEXT_PUBLIC_COUCH_URL!
const DB_NAME = process.env.NEXT_PUBLIC_COUCH_DB || "gestion_pwa"

export const localDB = new PouchDB(DB_NAME, {
  auto_compaction: true,
  revs_limit: 10,
})

function mkRemoteDB() {
  const base = COUCH_URL.replace(/\/+$/, "")
  const url = `${base}/${DB_NAME}`
  return new PouchDB(url, {
    skip_setup: true,
    fetch: (url: any, opts: any) => fetch(url as RequestInfo, { ...(opts || {}), credentials: "include" }),
  })
}

let syncHandler: PouchDB.Replication.Sync<{}> | null = null

function log(...args: any[]) {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[Pouch]", ...args)
  }
}

// -------- Auth (CouchDB cookie) --------
export async function loginOnlineToCouchDB(name: string, password: string): Promise<void> {
  const res = await fetch(`${COUCH_URL}/_session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name, password }),
  })
  if (!res.ok) {
    let msg = "Credenciales inválidas"
    try {
      const j = await res.json()
      msg = (j?.reason || j?.error || msg)
    } catch {}
    throw new Error(msg)
  }
}

export async function logoutFromCouchDB(): Promise<void> {
  try {
    await fetch(`${COUCH_URL}/_session`, { method: "DELETE", credentials: "include" })
  } catch {}
  stopSync()
}

// -------- Sync helpers --------
export async function primeLocalFromRemote(): Promise<void> {
  const remote = mkRemoteDB()
  await localDB.replicate.from(remote, { retry: true })
}

export function startSync(): void {
  if (syncHandler) return
  const remote = mkRemoteDB()
  syncHandler = PouchDB.sync(localDB, remote, {
    live: true,
    retry: true,
    batch_size: 100,
    back_off_function: (delay) => (delay === 0 ? 1000 : Math.min(delay * 2, 60000)),
  })
    .on("change", (info) => log("change", info.direction, info.change?.docs?.length ?? 0))
    .on("paused", (err) => log("paused", err || "ok"))
    .on("active", () => log("active"))
    .on("denied", (err) => log("denied", err))
    .on("error", (err) => log("error", err))
}

export function stopSync(): void {
  if (syncHandler) {
    syncHandler.cancel()
    syncHandler = null
  }
}

export async function bootstrapAfterLogin(): Promise<void> {
  const info = await localDB.info()
  const count = (info as any).doc_count ?? 0
  const seq = (info as any).update_seq ?? 0
  if (count + (Number(seq) || 0) < 1) {
    await primeLocalFromRemote()
  }
  await ensureIndexes()
  startSync()
}

// -------- Indexes --------
async function ensureIndexes() {
  try {
    await (localDB as any).createIndex({
      index: { fields: ["type", "email"] },
      ddoc: "idx_type_email",
      name: "idx_type_email",
    } as any)

    await (localDB as any).createIndex({
      index: { fields: ["type", "createdAt"] },
      ddoc: "idx_type_createdAt",
      name: "idx_type_createdAt",
    } as any)
  } catch {}
}

// -------- CRUD Users --------
const usersPrefix = "user_"

export async function getAllUsers(): Promise<User[]> {
  const res = await (localDB as any).find({
    selector: { type: "user" },
    sort: ["type"],
  })
  return res.docs as User[]
}

export async function createUser(u: User): Promise<void> {
  await localDB.put({ ...u, _id: u._id || `${usersPrefix}${u.id}` })
}

export async function updateUser(u: User): Promise<void> {
  const _id = u._id || `${usersPrefix}${u.id}`
  const current = await localDB.get(_id).catch(() => null as any)
  await localDB.put({
    ...current,
    ...u,
    _id,
    updatedAt: new Date().toISOString(),
  })
}

export async function softDeleteUser(idOrCouchId: string): Promise<void> {
  const _id = idOrCouchId.startsWith("user_") ? idOrCouchId : `${usersPrefix}${idOrCouchId}`
  const doc = await localDB.get(_id)
  await localDB.put({ ...doc, isActive: false, updatedAt: new Date().toISOString() })
}

export async function deleteUserById(idOrCouchId: string): Promise<void> {
  const _id = idOrCouchId.startsWith("user_") ? idOrCouchId : `${usersPrefix}${idOrCouchId}`
  const doc = await localDB.get(_id)
  await localDB.remove(doc)
}
