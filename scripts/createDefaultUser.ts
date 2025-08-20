import PouchDBCore from "pouchdb";
import type { User } from "@/lib/types";
type ExistingDoc<T> = T & { _id: string; _rev: string };

const DB_NAME = "pwa-purp";
const db = new PouchDBCore(DB_NAME);

export async function createDefaultUser(): Promise<User> {
  const id = "user_default_admin";
  try {
    const existing: ExistingDoc<User> = await db.get<User>(id);
    return { ...existing, id: existing.id ?? id } as User;
  } catch (err: any) {
    if (err?.status !== 404) throw err;
  }
  const now = new Date().toISOString();
  const user: User = {
    id,
    _id: id,
    name: "Administrador",
    email: "admin@purp.com.mx",
    role: "administrador",
    permissions: ["read", "write", "manage_users"],
    isActive: true,
    createdAt: now,
    updatedAt: now,
    type: "user_profile",
  };
  await db.put({ _id: id, ...user });
  return user;
}
