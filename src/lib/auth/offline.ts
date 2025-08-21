// src/lib/auth/offline.ts
import { localdb } from "../pouch/localdb";

interface UserDoc {
  _id: string;
  email: string;
  password: string;
  role?: string;
}

export async function loginOffline(data: { email: string; password: string }) {
  const result = await localdb.get<UserDoc>(`user:${data.email}`);
  if (result && result.password === data.password) {
    return { user: result, token: "offline-token", role: result.role || "user" };
  }
  throw new Error("Credenciales inválidas");
}
