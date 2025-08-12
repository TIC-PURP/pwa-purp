// lib/database.ts
import PouchDB from "pouchdb-browser";
import PouchFind from "pouchdb-find";
import type { User as AppUser } from "@/lib/types";

PouchDB.plugin(PouchFind);

const COUCH_URL = process.env.NEXT_PUBLIC_COUCH_URL!;
const DB_NAME = process.env.NEXT_PUBLIC_COUCH_DB || "gestion_pwa";

export const localDB = new PouchDB(DB_NAME, {
  auto_compaction: true,
  revs_limit: 10,
});

function mkRemoteDB() {
  const remoteUrl = `${COUCH_URL.replace(/\/+$/, "")}/${DB_NAME}`;
  return new PouchDB(remoteUrl, {
    skip_setup: true,
    fetch: (url: any, opts: any) =>
      fetch(url, { ...opts, credentials: "include" }),
  });
}

let syncHandler: PouchDB.Replication.Sync<{}> | null = null;

function log(...args: any[]) {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.log("[Pouch]", ...args);
  }
}

// ---------- LOGIN / LOGOUT ----------
export async function loginOnlineToCouchDB(
  name: string,
  password: string
): Promise<void> {
  const res = await fetch(`${COUCH_URL}/_session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name, password }),
  });

  if (!res.ok) {
    let msg = "Error desconocido";
    try {
      const j = await res.json();
      msg = j?.reason || j?.error || msg;
    } catch {}
    throw new Error(msg || "Credenciales inválidas");
  }
}

export async function logoutFromCouchDB(): Promise<void> {
  try {
    await fetch(`${COUCH_URL}/_session`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {}
  stopSync();
}

// ---------- SYNC ----------
export async function primeLocalFromRemote(): Promise<void> {
  const remote = mkRemoteDB();
  await localDB.replicate.from(remote, { retry: true });
}

export function startSync(): void {
  if (syncHandler) return;
  const remote = mkRemoteDB();

  syncHandler = PouchDB.sync(localDB, remote, {
    live: true,
    retry: true,
    batch_size: 100,
    back_off_function: (delay) => (delay === 0 ? 1000 : Math.min(delay * 2, 60000)),
  })
    .on("change", (info) => log("change", info.direction, info.change.docs?.length ?? 0))
    .on("paused", (err) => log("paused", err || "ok"))
    .on("active", () => log("active"))
    .on("denied", (err) => log("denied", err))
    .on("error", (err) => log("error", err));
}

export function stopSync(): void {
  if (syncHandler) {
    syncHandler.cancel();
    syncHandler = null;
  }
}

export async function bootstrapAfterLogin() {
  const info = await localDB.info();
  if ((info.doc_count ?? 0) + (info.update_seq as number) < 1) {
    await primeLocalFromRemote();
  }
  await ensureIndexes();
  startSync();
}

// ---------- ÍNDICES ----------
async function ensureIndexes() {
  try {
    // Algunos @types no aceptan 'name'; dejamos solo 'ddoc' e 'index'
    await (localDB as any).createIndex({
      index: { fields: ["type", "email"] },
      ddoc: "idx_type_email",
    });

    await (localDB as any).createIndex({
      index: { fields: ["type", "createdAt"] },
      ddoc: "idx_type_createdAt",
    });
  } catch {}
}

// ---------- Tipos internos ----------
type UserDoc = AppUser & { type: "user" };
const usersPrefix = "user_";

// ---------- CRUD ----------
export async function getAllUsers(): Promise<AppUser[]> {
  const res = await localDB.find({
    selector: { type: "user" },
    sort: ["type"],
  });
  // Quitamos 'type' al devolver para que cuadre con AppUser
  return (res.docs as UserDoc[]).map(({ type, ...u }) => u);
}

export async function createUser(u: AppUser): Promise<void> {
  const _id = `${usersPrefix}${u.id}`;
  const doc: UserDoc = { ...u, type: "user", _id };
  await localDB.put(doc);
}

export async function updateUser(u: AppUser): Promise<void> {
  const _id = u._id || `${usersPrefix}${u.id}`;
  const current = (await localDB.get(_id).catch(() => null)) as any;
  const doc: UserDoc = {
    ...(current || {}),
    ...u,
    _id,
    type: "user",
    updatedAt: new Date().toISOString(),
  };
  await localDB.put(doc);
}

export async function softDeleteUser(idOrCouchId: string): Promise<void> {
  const _id = idOrCouchId.startsWith("user_")
    ? idOrCouchId
    : `${usersPrefix}${idOrCouchId}`;
  const doc = (await localDB.get(_id)) as UserDoc;
  await localDB.put({
    ...doc,
    isActive: false,
    updatedAt: new Date().toISOString(),
  } as UserDoc);
}

export async function deleteUserById(idOrCouchId: string): Promise<void> {
  const _id = idOrCouchId.startsWith("user_")
    ? idOrCouchId
    : `${usersPrefix}${idOrCouchId}`;
  const doc = await localDB.get(_id);
  await localDB.remove(doc);
}
