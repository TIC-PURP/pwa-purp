import PouchDB from "pouchdb-browser";
let _db: PouchDB.Database | null = null;
export function secretsDB() {
  if (!_db) _db = new PouchDB("_localcache_secrets", { auto_compaction: true });
  return _db;
}
