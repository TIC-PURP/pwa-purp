// lib/database.ts — versión corregida y compatible con proxy / API
import PouchDB from 'pouchdb-browser';
import PouchFind from 'pouchdb-find';

PouchDB.plugin(PouchFind);

export type CouchEnv = { serverBase: string; serverWithAuth: string; dbName: string };

const DEFAULT_REMOTE_DB = (process.env.NEXT_PUBLIC_COUCHDB_DB || 'gestion_pwa').trim();

function stripTrailingSlash(s: string) {
  return s.replace(/\/+$/, '');
}

export function parseCouchEnv(raw?: string): CouchEnv {
  if (!raw) {
    return { serverBase: '', serverWithAuth: '', dbName: DEFAULT_REMOTE_DB };
  }

  try {
    // Soporta ruta relativa (p. ej. /api/couch/gestion_pwa)
    if (raw.startsWith('/')) {
      const parts = raw.split('/').filter(Boolean);
      const dbName = parts.length ? parts[parts.length - 1] : DEFAULT_REMOTE_DB;
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return { serverBase: origin, serverWithAuth: origin, dbName };
    }

    // URL absoluta
    const url = new URL(raw);

    // Determinar dbName desde el path o variable NEXT_PUBLIC_COUCHDB_DB
    const path = stripTrailingSlash(url.pathname || '/');
    const lastSeg = path.split('/').filter(Boolean).slice(-1)[0];
    const dbName = (lastSeg || process.env.NEXT_PUBLIC_COUCHDB_DB || DEFAULT_REMOTE_DB).toString().trim();

    // Base sin credenciales
    const serverBase = `${url.protocol}//${url.host}`;

    // Base con credenciales si venían en la URL
    let serverWithAuth = serverBase;
    if (url.username) {
      const user = decodeURIComponent(url.username);
      const pass = decodeURIComponent(url.password || '');
      const at = pass ? `${user}:${pass}@` : `${user}@`;
      serverWithAuth = `${url.protocol}//${at}${url.host}`;
    }

    return { serverBase, serverWithAuth, dbName };
  } catch {
    return { serverBase: '', serverWithAuth: '', dbName: DEFAULT_REMOTE_DB };
  }
}

export const isClient = typeof window !== 'undefined';

// Devuelve la DB local (IndexedDB)
export function getLocalDB(name?: string) {
  const { dbName } = parseCouchEnv(process.env.NEXT_PUBLIC_COUCHDB_URL);
  return new PouchDB(name || dbName);
}

// Devuelve la DB remota (CouchDB vía CloudFront o Proxy)
export function getRemoteDB(customUrl?: string) {
  const raw = (customUrl || process.env.NEXT_PUBLIC_COUCHDB_URL || '').trim();
  const env = parseCouchEnv(raw);

  let url = raw;
  if (!raw) {
    // fallback
    url = `/${env.dbName}`;
  } else if (!raw.startsWith('/')) {
    // URL absoluta: reconstruye <base>/<db>
    const base = env.serverWithAuth || env.serverBase;
    url = `${stripTrailingSlash(base)}/${env.dbName}`;
  } else {
    // Ruta relativa (proxy): úsala tal cual
    url = raw;
  }

  return new PouchDB(url);
}

// Sincronización continua
export function startSync(local: PouchDB.Database, remote: PouchDB.Database) {
  const handler = local.sync(remote, { live: true, retry: true });
  handler.on('error', (e: any) => console.error('[pouch sync error]', e));
  return handler;
}

export { PouchDB };
