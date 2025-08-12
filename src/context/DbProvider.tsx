'use client';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import PouchDB from 'pouchdb-browser';
import { getLocal, getRemote, startSync, ensureIndexes } from '@/src/lib/pouch';

type Ctx = { local: PouchDB.Database|null; remote: PouchDB.Database|null; syncing: boolean; online: boolean };
const DbCtx = createContext<Ctx>({ local: null, remote: null, syncing: false, online: true });
export const useDb = () => useContext(DbCtx);

export default function DbProvider({ children }: { children: React.ReactNode }) {
  const [local, setLocal] = useState<PouchDB.Database|null>(null);
  const [remote, setRemote] = useState<PouchDB.Database|null>(null);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const l = getLocal(); const r = getRemote();
    setLocal(l); setRemote(r); ensureIndexes(l);
    const on = () => setOnline(true); const off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    setOnline(navigator.onLine);
    startSync(l, r).then(()=>setSyncing(true));
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const value = useMemo(() => ({ local, remote, syncing, online }), [local, remote, syncing, online]);
  return <DbCtx.Provider value={value}>{children}</DbCtx.Provider>;
}
