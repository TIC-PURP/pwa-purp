// Offline verifier PBKDF2 (email:password) stored ONLY locally
import { secretsDB } from "@/lib/pouch/localdb";

type VerifierDoc = {
  _id: string;
  email: string;
  saltB64: string;
  iter: number;
  derivedB64: string;
  roles?: string[];
  type: "offline_verifier";
};

const enc = new TextEncoder();
function b64(buf: ArrayBuffer){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function fromB64(b: string){
  const bin = atob(b); const a = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i);
  return a.buffer;
}
async function pbkdf2(email: string, password: string, salt: ArrayBuffer, iter=600000){
  const data = `${email}:${password}`;
  const key = await crypto.subtle.importKey("raw", enc.encode(data), {name:"PBKDF2"}, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", hash:"SHA-256", iterations: iter, salt}, key, 256);
  return bits;
}

export async function saveOfflineVerifier(email: string, password: string, roles: string[] = []){
  const db = secretsDB();
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const iter = 600000;
  const derived = await pbkdf2(email, password, salt, iter);
  const doc: any = {
    _id: `_local/offline_user:${email}`,
    email, saltB64: b64(salt), iter, derivedB64: b64(derived), roles, type: "offline_verifier"
  };
  try{ const old = await db.get(doc._id); doc._rev = old._rev; } catch {}
  await db.put(doc);
}

export async function verifyOffline(email: string, password: string){
  const db = secretsDB(); const id = `_local/offline_user:${email}`;
  try{
    const doc: any = await db.get(id);
    const salt = fromB64(doc.saltB64);
    const derived = await pbkdf2(email, password, salt, doc.iter);
    return b64(derived) === doc.derivedB64 ? { ok: true, roles: doc.roles||[] } : { ok: false };
  }catch{ return { ok: false }; }
}
