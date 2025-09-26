// src/lib/db/appDB.ts
import PouchDB from 'pouchdb-browser';

const APP_DB_NAME = 'pwa-purp';

// Local DB for module B tests
export function getAppLocalDB() {
  // Keep the same name locally for simplicity
  return new PouchDB(APP_DB_NAME);
}

// Remote DB via Next proxy (/api/couch)
export function getAppRemoteDB() {
  return new PouchDB(`/api/couch/${APP_DB_NAME}`, {
    skip_setup: false,
    fetch: (url: any, opts: any = {}) => fetch(url, { ...opts, credentials: 'include' }),
  } as any);
}
