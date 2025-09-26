// src/lib/db/usersRemote.ts
import PouchDB from 'pouchdb-browser';

// Usar el proxy local de Next que mantiene cookie de /_session
// COUCH_HOST se usa solo del lado servidor; en cliente usamos /api/couch
export function getUsersRemoteDB() {
  return new PouchDB(`/api/couch/_users`, {
    skip_setup: true,
    fetch: (url: any, opts: any = {}) => {
      return fetch(url, { ...opts, credentials: 'include' });
    }
  } as any);
}

export const userDocId = (email: string) => `org.couchdb.user:${email}`;
