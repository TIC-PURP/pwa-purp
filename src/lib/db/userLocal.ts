// src/lib/db/userLocal.ts
import PouchDB from 'pouchdb-browser';

export function getUserLocalDB(userId: string) {
  const safe = userId.replace(/[^a-z0-9_\-\.]/gi, '_');
  return new PouchDB(`user_local_${safe}`);
}
