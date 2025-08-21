// src/lib/pouch/localdb.ts
import PouchDB from "pouchdb-browser";

export const localdb = new PouchDB("purp-localdb");

export function syncWithCouch(remoteUrl: string) {
  const remoteDb = new PouchDB(remoteUrl, {
    skip_setup: true,
    fetch: (url: any, opts: any) => {
      return PouchDB.fetch(url, { ...opts, credentials: "include" });
    },
  });

  return localdb
    .sync(remoteDb, {
      live: true,
      retry: true,
    })
    .on("change", (info) => {
      console.log("Sync cambio detectado:", info);
    })
    .on("paused", (err) => {
      console.log("Sync pausado:", err);
    })
    .on("active", () => {
      console.log("Sync reanudado.");
    })
    .on("error", (err) => {
      console.error("Error en sync:", err);
    });
}
