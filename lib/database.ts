"use client";

// /lib/database.ts
import PouchDB from "pouchdb-browser";
import PouchFind from "pouchdb-find";

PouchDB.plugin(PouchFind);

// ----- Config -----
const COUCH_URL = process.env.NEXT_PUBLIC_COUCH_URL!;
const DB_NAME = process.env.NEXT_PUBLIC_COUCH_DB || "gestion_pwa";

// DB local única de la app (IndexedDB)
export const localDB = new PouchDB(DB_NAME, {
  auto_compaction: true,
  revs_limit: 10,
});

// Si usas cookie de Couch, hay que forzar credentials en cada fetch del remoto
function mkRemoteDB() {
  const remoteUrl = `${COUCH_URL.replace(/\/+$/, "")}/${DB_NAME}`;
  return new PouchDB(remoteUrl, {
    skip_setup: true,
    fetch: (url: any, opts: any) =>
      fetch(url, { ...opts, credentials: "include" } as RequestInit),
  });
}

// Mantengo una referencia global al replicador para poder cancelarlo
let syncHandler: PouchDB.Replication.Sync<{}> | null = null;

// Pequeño logger visible en consola
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
      msg = (j as any)?.reason || (j as any)?.error || msg;
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
    back_off_function: (delay: number) => {
      if (delay === 0) return 1000;
      return Math.min(delay * 2, 60_000);
    },
  })
    .on("change", (info: any) => log("change", info.direction, info.change?.docs?.length ?? 0))
    .on("paused", (err: any) => log("paused", err || "ok"))
    .on("active", () => log("active"))
    .on("denied", (err: any) => log("denied", err))
    .on("error", (err: any) => log("error", err));
}

export function stopSync(): void {
  if (syncHandler) {
    syncHandler.cancel();
    syncHandler = null;
  }
}

export async function bootstrapAfterLogin() {
  const info = await localDB.info();
  if (((info as any).doc_count ?? 0) + (info.update_seq as number) < 1) {
    await primeLocalFromRemote();
  }
  await ensureIndexes();
  startSync();
}

// ---------- ÍNDICES / DISEÑOS ----------

async function ensureIndexes() {
  try {
    await localDB.createIndex({
      index: { fields: ["type", "email"] },
    });
    await localDB.createIndex({
      index: { fields: ["type", "createdAt"] },
    });
  } catch {}
}

// ---------- Tipos & CRUD ----------

export type UserRole = "manager" | "user" | "administrador";
export type Permission =
  | "users_read"
  | "users_write"
  | "users_delete"
  | "app_access";

export interface User {
  _id?: string;
  _rev?: string;
  id: string;
  type: "user";
  name: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const usersPrefix = "user_";

export async function getAllUsers(): Promise<User[]> {
  const res = await localDB.find({
    selector: { type: "user" },
    sort: ["type"],
  });
  return res.docs as User[];
}

export async function createUser(u: User): Promise<void> {
  await localDB.put({ ...u, _id: `${usersPrefix}${u.id}` });
}

export async function updateUser(u: User): Promise<void> {
  const _id = u._id || `${usersPrefix}${u.id}`;
  const current = await localDB.get(_id).catch(() => null as any);
  await localDB.put({
    ...(current || {}),
    ...u,
    _id,
    updatedAt: new Date().toISOString(),
  });
}

export async function softDeleteUser(idOrCouchId: string): Promise<void> {
  const _id = idOrCouchId.startsWith("user_")
    ? idOrCouchId
    : `${usersPrefix}${idOrCouchId}`;
  const doc = await localDB.get(_id);
  await localDB.put({ ...doc, isActive: false, updatedAt: new Date().toISOString() });
}

export async function deleteUserById(idOrCouchId: string): Promise<void> {
  const _id = idOrCouchId.startsWith("user_")
    ? idOrCouchId
    : `${usersPrefix}${idOrCouchId}`;
  const doc = await localDB.get(_id);
  await localDB.remove(doc);
}

// --- AGREGAR AL FINAL DE lib/database.ts ---

/** Login con preferencia online y fallback offline */
export async function authenticateUser(email: string, password: string) {
  try {
    // Online: cookie + bootstrap + buscar perfil
    await loginOnlineToCouchDB(email, password);
    await bootstrapAfterLogin();

    const res = await localDB.find({
      selector: { type: "user", email },
      limit: 1,
    });

    let user = res.docs[0] as User | undefined;

    if (!user) {
      // Si no hay perfil, creamos uno mínimo local (se replicará si el user tiene permisos)
      const now = new Date().toISOString();
      user = {
        type: "user",
        id: crypto.randomUUID(),
        name: email.split("@")[0],
        email,
        role: "user" as any,
        permissions: ["app_access"] as any,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      await createUser(user);
    }

    guardarUsuarioOffline(user);
    return { ok: true, user, offline: false as const };
  } catch (e) {
    // Offline: permitir si ya existe el perfil local (sin validar password)
    const res = await localDB.find({
      selector: { type: "user", email },
      limit: 1,
    });
    const user = res.docs[0] as User | undefined;
    if (user) {
      guardarUsuarioOffline(user);
      return { ok: true, user, offline: true as const };
    }
    return { ok: false, error: "Credenciales inválidas o sin datos locales." };
  }
}

/** Guarda un pequeño rastro para reabrir sesión offline */
export function guardarUsuarioOffline(user: User) {
  try {
    localStorage.setItem("purp.last_user_email", user.email);
    localStorage.setItem("purp.last_user_id", user.id);
  } catch {}
}

/** Semilla opcional del manager (solo si pones las envs). Si no, no hace nada. */
export async function initializeDefaultUsers() {
  try {
    const anyUser = await localDB.find({ selector: { type: "user" }, limit: 1 });
    if (anyUser.docs.length > 0) return;

    const email = process.env.NEXT_PUBLIC_SEED_MANAGER_EMAIL;
    const password = process.env.NEXT_PUBLIC_SEED_MANAGER_PASSWORD;
    const name = process.env.NEXT_PUBLIC_SEED_MANAGER_NAME || "Manager";

    if (!email || !password) return; // sin envs => no seed

    const now = new Date().toISOString();
    const user: User = {
      type: "user",
      id: crypto.randomUUID(),
      name,
      email,
      role: "manager" as any,
      permissions: ["app_access", "users_read", "users_write", "users_delete"] as any,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await createUser(user);
  } catch {}
}
