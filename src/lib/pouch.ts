import PouchDB from 'pouchdb-browser';
import PouchFind from 'pouchdb-find';

PouchDB.plugin(PouchFind);

export type DBPair = { local: PouchDB.Database; remote: PouchDB.Database };

// Cuando uses el API proxy, configura NEXT_PUBLIC_COUCHDB_URL = '/api/couch/gestion_pwa'
const BASE_URL = process.env.NEXT_PUBLIC_COUCHDB_URL || '/api/couch/gestion_pwa';

export function getLocal(dbName?: string) {
  const name = dbName || BASE_URL.split('/').pop() || 'appdb';
  return new PouchDB(name); // IndexedDB
}

export function getRemote(customUrl?: string) {
  const url = customUrl || BASE_URL;
  return new PouchDB(url);
}

export async function startSync(local: PouchDB.Database, remote: PouchDB.Database) {
  const handler = local.sync(remote, { live: true, retry: true });
  handler.on('error', (e: any) => console.error('[pouch sync error]', e));
  return handler;
}

export async function ensureIndexes(db: PouchDB.Database) {
  try { await db.createIndex({ index: { fields: ['type', 'email'] }, ddoc: 'idx-users', name: 'by_type_email' }); } catch {}
  try { await db.createIndex({ index: { fields: ['type', 'updatedAt'] }, ddoc: 'idx-updated', name: 'by_type_updated' }); } catch {}
}
