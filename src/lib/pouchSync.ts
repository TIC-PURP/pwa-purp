// Drop-in replacement or helper for your PouchDB <-> CouchDB sync with better backoff.
// Path: /src/lib/pouchSync.ts

import PouchDB from 'pouchdb-browser';

export type SyncOptions = {
  remoteUrl: string;
  dbName: string;
};

export function getDb(dbName: string) {
  // If you already have a centralized DB factory, ignore this and use yours.
  return new PouchDB(dbName, { auto_compaction: true, revs_limit: 50 });
}

export function startSync(db: PouchDB.Database, remoteUrl: string) {
  const opts: any = {
    live: true,
    retry: true,
    heartbeat: 25000,
    timeout: 55000,
    back_off_function: function (delay: number) {
      if (!delay) return 1000; // 1s
      return Math.min(delay * 2, 5 * 60 * 1000); // cap at 5 min
    }
  };

  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) {
      return err.message;
    }

    if (typeof err === 'string') {
      return err;
    }

    try {
      return JSON.stringify(err);
    } catch (jsonError) {
      console.debug('[sync paused: stringify error]', jsonError);
      return String(err);
    }
  };

  const sync = db.sync(remoteUrl, opts)
    .on('change', info => console.debug('[sync change]', info.direction, info.change && info.change.docs && info.change.docs.length))
    .on('paused', (err: unknown) => {
      if (err) {
        console.warn('[sync paused: error]', getErrorMessage(err));
      } else {
        console.debug('[sync paused: up-to-date]');
      }
    })
    .on('active', () => console.debug('[sync active]'))
    .on('error', err => console.error('[sync error]', err));

  return sync;
}