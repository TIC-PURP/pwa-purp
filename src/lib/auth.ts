import PouchDB from 'pouchdb-browser';
import bcrypt from 'bcryptjs';
import { getLocal, getRemote, ensureIndexes } from './pouch';

export type AppUser = {
  _id: string; type: 'user'; email: string; name?: string; passHash: string; roles: string[];
  createdAt: string; updatedAt: string;
};
const ID = (email: string) => `user:${email.toLowerCase()}`;

export async function createUserOnline(email: string, password: string, name?: string) {
  const remote = getRemote();
  const now = new Date().toISOString();
  const doc: AppUser = {
    _id: ID(email), type: 'user', email: email.toLowerCase(), name,
    passHash: await bcrypt.hash(password, 10), roles: ['user'], createdAt: now, updatedAt: now,
  };
  await remote.put(doc); // escribe en remoto → otros devices pueden bajarlo
  const local = getLocal(); await ensureIndexes(local);
  try { await local.put(doc); } catch(e:any) { /* ignore 409 */ }
  return doc;
}

export async function loginOfflineFirst(email: string, password: string) {
  const local = getLocal(); await ensureIndexes(local);
  const id = ID(email);
  let user: AppUser | null = null;
  try { user = await local.get(id) as AppUser; } catch {}
  if (!user) { // primer login requiere online
    const remote = getRemote();
    try { user = await remote.get(id) as AppUser; await local.put(user) } 
    catch { throw new Error('Usuario no encontrado. Conéctate a Internet para el primer inicio de sesión.'); }
  }
  const ok = await bcrypt.compare(password, (user as AppUser).passHash);
  if (!ok) throw new Error('Contraseña incorrecta');
  return user!;
}
