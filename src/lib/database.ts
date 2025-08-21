// src/lib/database.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import PouchDBCore from "pouchdb";
import PouchFind from "pouchdb-find";

PouchDBCore.plugin(PouchFind);

// ===== Tipos =====
type AppRole = "manager" | "admin" | "user";

export type UserProfileDoc = {
  _id?: string;
  _rev?: string;
  type: "user_profile";
  email: string;
  name: string;
  role: AppRole;
  isActive: boolean;
  permissions?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // soporta borrado lógico con fecha
};

type UserOp = {
  _id: string;
  type: "user_op";
  op: "create" | "update" | "delete";
  email: string;
  payload?: any;
  status: "pending" | "applied";
  createdAt: string;
  updatedAt: string;
};

type PendingUserOpInput = { op: UserOp["op"]; email: string; payload?: any };

// ===== Utils =====
const isBrowser = typeof window !== "undefined";

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta variable de entorno ${name}`);
  return v;
}

function getRemoteDbUrl(): string {
  // Debe incluir la DB: p. ej. http://host:5984/pwa-purp
  const raw = assertEnv("NEXT_PUBLIC_COUCHDB_URL");
  const url = new URL(raw);
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

function getLocalDbName(): string {
  try {
    const u = new URL(getRemoteDbUrl());
    const db = u.pathname.split("/").filter(Boolean).pop() || "pwa-purp";
    return `local-${db}`;
  } catch {
    return "local-pwa";
  }
}

// ===== Singletons Pouch =====
let _localDb: PouchDB.Database | null = null;
let _syncHandler: PouchDB.Replication.Sync<{}> | null = null;

export function getPouch(): PouchDB.Database {
  if (!_localDb) {
    const name = getLocalDbName();
    const db = new PouchDBCore(name, { auto_compaction: true }); // no-null
    _localDb = db;
    ensureIndexes(db).catch(() => {});
  }
  return _localDb!;
}

function getRemoteDb(): { url: string } {
  const url = getRemoteDbUrl();
  return { url };
}

async function ensureIndexes(db: PouchDB.Database) {
  try {
    await (db as any).createIndex?.({ index: { fields: ["type"] } });
  } catch {}
  try {
    await (db as any).createIndex?.({ index: { fields: ["type", "email"] } });
  } catch {}
}

// ===== Sync =====
export function startSync(): void {
  if (!isBrowser) return;
  const db = getPouch();
  const { url } = getRemoteDb();
  if (_syncHandler) return;

  const syncFn: any = (db as any).sync;
  _syncHandler = syncFn(url, {
    live: true,
    retry: true,
    back_off_function: (delay: number) => Math.min((delay || 1000) * 2, 30000),
    fetch: (input: RequestInfo, init?: RequestInit) =>
      fetch(input as any, { ...(init || {}), credentials: "include" }),
  })
    .on("change", (info: any) => console.log("[sync] change", info?.direction ?? ""))
    .on("paused", (err: any) => console.log("[sync] paused", err ? "err" : "ok"))
    .on("active", () => console.log("[sync] active"))
    .on("error", (err: any) => console.warn("[sync] error", (err as any)?.message || err));
}

export function stopSync(): void {
  if (_syncHandler) {
    _syncHandler.cancel();
    _syncHandler = null;
  }
}

// ===== Auth a Couch (_session) =====
export async function loginOnlineToCouchDB(name: string, password: string) {
  const body = new URLSearchParams();
  body.set("name", name);
  body.set("password", password);

  const res = await fetch("/api/couch/_session", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    credentials: "include",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`No se pudo iniciar sesión Couch: ${t}`);
  }
  return res.json();
}

export async function logoutOnlineSession() {
  await fetch("/api/couch/_session", {
    method: "DELETE",
    credentials: "include",
  }).catch(() => {});
}

export async function getCouchSession(): Promise<any> {
  const res = await fetch("/api/couch/_session", {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudo leer la sesión");
  return res.json();
}

// ===== Perfil (DB de la app: Pouch/Couch) =====
export async function findUserByEmail(email: string): Promise<UserProfileDoc | null> {
  const db = getPouch();
  const q = await (db as any).find({
    selector: { type: "user_profile", email },
    limit: 1,
  });
  return (q.docs?.[0] as UserProfileDoc) || null;
}

// Creador/actualizador de perfil local (NO confundir con el wrapper de UI)
export async function createUserProfile(input: Partial<UserProfileDoc>): Promise<UserProfileDoc> {
  const db = getPouch();
  const now = new Date().toISOString();

  const doc: UserProfileDoc = {
    _id: input._id,
    type: "user_profile",
    email: String(input.email || "").toLowerCase(),
    name: input.name || (input.email ? String(input.email).split("@")[0] : "usuario"),
    role: (input.role as AppRole) || "user",
    isActive: input.isActive !== false,
    permissions: input.permissions || ["read"],
    createdAt: input.createdAt || now,
    updatedAt: now,
    ...(input.deletedAt ? { deletedAt: input.deletedAt } : {}),
  };

  if (!doc._id) doc._id = `user_profile:${doc.email}`;

  const existing = await findUserByEmail(doc.email);
  if (existing) {
    const merged: UserProfileDoc = {
      ...existing,
      ...doc,
      _id: existing._id,
      _rev: existing._rev,
      updatedAt: now,
    };
    const r = await (db as any).put(merged);
    merged._rev = r.rev;
    return merged;
  }

  const r = await (db as any).put(doc as any);
  doc._rev = r.rev;
  return doc;
}

export async function updateUserByEmail(email: string, patch: Partial<UserProfileDoc>): Promise<UserProfileDoc | null> {
  const db = getPouch();
  const ex = await findUserByEmail(email);
  if (!ex) return null;
  const updated: UserProfileDoc = {
    ...ex,
    ...patch, // incluye deletedAt si viene
    _id: ex._id,
    _rev: ex._rev,
    updatedAt: new Date().toISOString(),
  };
  const r = await (db as any).put(updated as any);
  updated._rev = r.rev;
  return updated;
}

export async function deleteUserByEmail(email: string): Promise<boolean> {
  const db = getPouch();
  const ex = await findUserByEmail(email);
  if (!ex) return false;
  const now = new Date().toISOString();
  const updated = { ...ex, isActive: false, deletedAt: now, updatedAt: now };
  const r = await (db as any).put(updated as any);
  return !!r.ok;
}

// ===== Cola OFFLINE (para reflejar /_users cuando vuelva la red) =====
export async function queueUserOp(op: PendingUserOpInput) {
  const db = getPouch();
  const now = new Date().toISOString();
  const uuid =
    (globalThis as any).crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  const doc: UserOp = {
    _id: `user_op:${uuid}`,
    type: "user_op",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    ...op,
  };
  await (db as any).put(doc as any);
  return doc;
}

export async function replayPendingUserOps() {
  const db = getPouch();
  const all = await (db as any).find({ selector: { type: "user_op", status: "pending" }, limit: 200 });
  const docs: UserOp[] = (all.docs ?? []).map((d: any) => d as unknown as UserOp);

  for (const op of docs) {
    try {
      if (op.op === "create") {
        await createAppUserOnline(op.payload);
      } else if (op.op === "update") {
        await updateAppUserOnline(op.email, op.payload);
      } else if (op.op === "delete") {
        await deleteAppUserOnline(op.email);
      }
      op.status = "applied";
      op.updatedAt = new Date().toISOString();
      await (db as any).put(op as any);
    } catch (e) {
      console.warn("[replayPendingUserOps] pendiente", (e as any)?.message || e);
    }
  }
}

// ===== APIs server del panel (/_users + perfil remoto) =====
export async function createAppUserOnline(payload: {
  email: string;
  password: string;
  role: AppRole | string;
  name?: string;
  isActive?: boolean;
  permissions?: string[];
}) {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateAppUserOnline(
  email: string,
  patch: Partial<{ password: string; role: AppRole | string; name: string; isActive: boolean }>
) {
  const res = await fetch(`/api/users/${encodeURIComponent(email)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteAppUserOnline(email: string) {
  const res = await fetch(`/api/users/${encodeURIComponent(email)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ===== Inicialización =====
export async function initializeDefaultUsers() {
  const db = getPouch();
  await ensureIndexes(db);
  return true;
}

export async function guardarUsuarioOffline(payload: { email: string; name?: string; role?: AppRole }) {
  try {
    if (isBrowser) {
      window.localStorage.setItem("offline_user_info", JSON.stringify(payload));
    } else {
      const db = getPouch();
      const id = `offline_user:${payload.email}`;
      let existing: any = null;
      try {
        existing = await (db as any).get(id);
      } catch {}
      const now = new Date().toISOString();
      const doc = {
        _id: id,
        type: "offline_user",
        ...existing,
        ...payload,
        updatedAt: now,
        createdAt: existing?.createdAt || now,
      };
      await (db as any).put(doc);
    }
  } catch (e) {
    console.warn("guardarUsuarioOffline warn:", (e as any)?.message || e);
  }
}

// ===== Funciones de alto nivel para el Panel (local + server + offline) =====
export async function createUserFromPanel(input: {
  email: string;
  password: string;
  role: AppRole | string;
  name?: string;
  isActive?: boolean;
  permissions?: string[];
}) {
  // 1) Guarda/actualiza perfil local (fuente de UI)
  const doc = await createUserProfile({
    email: input.email,
    name: input.name || input.email.split("@")[0],
    role: (String(input.role).toLowerCase() as AppRole) || "user",
    isActive: input.isActive !== false,
    permissions: input.permissions || ["read"],
  });

  // 2) Intenta reflejar en /_users + perfil remoto
  try {
    await createAppUserOnline({
      email: input.email,
      password: input.password,
      role: (String(input.role).toLowerCase() as AppRole) || "user",
      name: input.name,
      isActive: input.isActive !== false,
      permissions: input.permissions || ["read"],
    });
  } catch {
    await queueUserOp({
      op: "create",
      email: doc.email,
      payload: {
        email: input.email,
        password: input.password,
        role: input.role,
        name: input.name,
        isActive: input.isActive !== false,
        permissions: input.permissions || ["read"],
      },
    });
  }

  return doc;
}

export async function updateUserFromPanel(
  email: string,
  patch: Partial<{ password: string; role: AppRole | string; name: string; isActive: boolean; deletedAt: string }>
) {
  // 1) Actualiza perfil local
  const updated = await updateUserByEmail(email, {
    ...(patch.name ? { name: patch.name } : {}),
    ...(patch.role ? { role: (String(patch.role).toLowerCase() as AppRole) } : {}),
    ...(typeof patch.isActive === "boolean" ? { isActive: patch.isActive } : {}),
    ...(patch.deletedAt ? { deletedAt: patch.deletedAt } : {}),
  });

  // 2) Refleja en /_users (password/role/name/isActive), deletedAt es sólo de UI/perfil
  try {
    await updateAppUserOnline(email, {
      ...(patch.name ? { name: patch.name } : {}),
      ...(patch.role ? { role: String(patch.role) } : {}),
      ...(typeof patch.isActive === "boolean" ? { isActive: patch.isActive } : {}),
      ...(patch.password ? { password: patch.password } : {}),
    });
  } catch {
    await queueUserOp({ op: "update", email, payload: patch });
  }

  return updated;
}

export async function deleteUserFromPanel(email: string) {
  // 1) Borrado lógico local (isActive=false, deletedAt)
  const ok = await deleteUserByEmail(email);

  // 2) Refleja en Couch _users (DELETE); si falla, cola
  try {
    await deleteAppUserOnline(email);
  } catch {
    await queueUserOp({ op: "delete", email });
  }
  return ok;
}

// ====== WRAPPERS compatibles con src/app/users/page.tsx ======

// Tipo de usuario que espera la UI (estructuralmente compatible)
type UIUser = {
  id: string;
  email: string;
  name: string;
  role: "manager" | "admin" | "user" | string; // tu UI puede usar "administrador", si lo mapeas en la vista
  isActive: boolean;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
};

function mapProfileToUI(u: UserProfileDoc): UIUser {
  return {
    id: u._id || `user_profile:${u.email}`,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    permissions: u.permissions,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    deletedAt: u.deletedAt,
  };
}

/** Lista usuarios para la tabla de la UI */
export async function getAllUsers(): Promise<UIUser[]> {
  const db = getPouch();
  const res = await (db as any).find({
    selector: { type: "user_profile" },
    limit: 5000,
  });
  const docs = (res.docs as unknown as UserProfileDoc[]) ?? [];
  return docs.map(mapProfileToUI);
}

/** CREATE (wrapper para la página) — valida password y usa createUserFromPanel */
export async function createUser(data: {
  email: string;
  password?: string; // tu CreateUserData la trae opcional; validamos aquí
  role: string;
  name?: string;
  isActive?: boolean;
  permissions?: string[];
}): Promise<UIUser> {
  const { email, password, role, name, isActive, permissions } = data;
  if (!email) throw new Error("email es requerido");
  if (!password) throw new Error("password es requerido");

  const profile = await createUserFromPanel({
    email,
    password,
    role,
    name,
    isActive,
    permissions,
  });

  return mapProfileToUI(profile);
}

/** UPDATE (wrapper) — acepta 1 o 2 argumentos */
export async function updateUser(
  a:
    | string
    | {
        id?: string;
        email: string;
        name?: string;
        role?: string;
        isActive?: boolean;
        password?: string;
        deletedAt?: string;
      },
  b?: Partial<{ name: string; role: string; isActive: boolean; password: string; deletedAt: string }>
): Promise<UIUser | null> {
  let email: string;
  let patch: Partial<{ name: string; role: string; isActive: boolean; password: string; deletedAt: string }>;

  if (typeof a === "string") {
    email = a;
    patch = b ?? {};
  } else {
    email = a.email;
    patch = {
      ...(a.name ? { name: a.name } : {}),
      ...(a.role ? { role: a.role } : {}),
      ...(typeof a.isActive === "boolean" ? { isActive: a.isActive } : {}),
      ...(a.password ? { password: a.password } : {}),
      ...(a.deletedAt ? { deletedAt: a.deletedAt } : {}),
    };
  }

  const updatedProfile = await updateUserFromPanel(email, patch);
  return updatedProfile ? mapProfileToUI(updatedProfile) : null;
}

/** SOFT DELETE (wrapper) — tu UI puede pasar email o id */
export async function softDeleteUser(idOrEmail: string): Promise<boolean> {
  const email = await resolveEmailFromIdOrEmail(idOrEmail);
  if (!email) return false;
  return deleteUserFromPanel(email);
}

/** DELETE by id (wrapper) — igual que softDeleteUser pero nombre distinto */
export async function deleteUserById(idOrEmail: string): Promise<boolean> {
  const email = await resolveEmailFromIdOrEmail(idOrEmail);
  if (!email) return false;
  return deleteUserFromPanel(email);
}

async function resolveEmailFromIdOrEmail(idOrEmail: string): Promise<string | null> {
  if (!idOrEmail) return null;
  // Si viene como 'user_profile:correo@dominio'
  if (idOrEmail.startsWith("user_profile:")) {
    return idOrEmail.slice("user_profile:".length);
  }
  // Si ya parece correo
  if (idOrEmail.includes("@")) return idOrEmail;

  // Si es un _id, intenta obtener el doc
  try {
    const db = getPouch();
    const doc = (await (db as any).get(idOrEmail)) as any;
    return doc?.email || null;
  } catch {
    return null;
  }
}

// src/lib/database.ts
export async function updateUserProfileRole(email: string, role: AppRole) {
  const db = getPouch();
  const q = await (db as any).find({ selector: { type: "user_profile", email }, limit: 1 });
  const doc = q.docs?.[0];
  if (!doc) throw new Error("Perfil no encontrado");
  doc.role = role;
  doc.updatedAt = new Date().toISOString();
  const put = await (db as any).put(doc);
  return { ...doc, _rev: put.rev };
}
