'use client';
import React, { useEffect, useState } from 'react';
import PouchDB from 'pouchdb-browser';
import { getAppLocalDB, getAppRemoteDB } from '@/lib/db/appDB';

type PhotoDoc = {
  _id: string;
  type: 'modB_test';
  createdAt: string;
  status?: 'local' | 'synced' | 'error';
  note?: string;
};

type RawPhotoDoc =
  | (PouchDB.Core.Document<Record<string, unknown>> & Partial<PhotoDoc>)
  | undefined;

type AttachmentValue = Blob | ArrayBuffer | ArrayBufferView | string;

const isValidStatus = (value: unknown): value is NonNullable<PhotoDoc['status']> =>
  value === 'local' || value === 'synced' || value === 'error';

const isAttachmentValue = (value: unknown): value is AttachmentValue =>
  value instanceof Blob ||
  typeof value === 'string' ||
  value instanceof ArrayBuffer ||
  ArrayBuffer.isView(value);

const attachmentToBlob = (value: AttachmentValue): Blob => {
  if (value instanceof Blob) {
    return value;
  }

  if (typeof value === 'string') {
    return new Blob([value]);
  }

  if (value instanceof ArrayBuffer) {
    return new Blob([value]);
  }

  const { buffer, byteOffset, byteLength } = value;
  const source = new Uint8Array(buffer, byteOffset, byteLength);
  const copy = new Uint8Array(byteLength);
  copy.set(source);
  return new Blob([copy.buffer]);
};

const normalizePhotoDoc = (doc: RawPhotoDoc): PhotoDoc | null => {
  if (!doc || doc.type !== 'modB_test') {
    return null;
  }

  return {
    _id: doc._id,
    type: 'modB_test',
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : '',
    status: isValidStatus(doc.status) ? doc.status : undefined,
    note: typeof doc.note === 'string' ? doc.note : undefined,
  };
};

export default function ModuleBPhotoTest() {
  const [localDB] = useState<PouchDB.Database>(() => getAppLocalDB());
  const [remoteDB] = useState<PouchDB.Database>(() => getAppRemoteDB());
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [docs, setDocs] = useState<PhotoDoc[]>([]);
  const [syncState, setSyncState] = useState<string>('idle');

  // Track online/offline
  useEffect(() => {
    const upd = () => setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    upd();
    window.addEventListener('online', upd);
    window.addEventListener('offline', upd);
    return () => {
      window.removeEventListener('online', upd);
      window.removeEventListener('offline', upd);
    };
  }, []);

  // Continuous sync
  useEffect(() => {
    setSyncState('connecting');
    const sync = (PouchDB as any).sync(localDB, remoteDB, { live: true, retry: true })
      .on('change', (info: any) => {
        setSyncState('change');
        refresh();
      })
      .on('paused', () => setSyncState('paused'))
      .on('active', () => setSyncState('active'))
      .on('denied', (err: any) => setSyncState('denied'))
      .on('complete', () => setSyncState('complete'))
      .on('error', (err: any) => setSyncState('error'));
    return () => { (sync.cancel && sync.cancel()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    const res = await localDB.allDocs({ include_docs: true, startkey: 'modB:', endkey: 'modB:\ufff0' });
    const list = res.rows
      .map((r) => normalizePhotoDoc(r.doc as RawPhotoDoc))
      .filter((doc): doc is PhotoDoc => doc !== null)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    setDocs(list);
  };

  useEffect(() => { refresh(); }, []);

  const saveLocal = async (blob: Blob, mime: string) => {
    const id = `modB:${Date.now()}`;
    const base: PhotoDoc = { _id: id, type: 'modB_test', createdAt: new Date().toISOString(), status: 'local' };
    await localDB.put(base);
    await localDB.putAttachment(id, 'photo', (await localDB.get(id))._rev, blob, mime).catch(async (err: any) => {
      if (err.status === 409) {
        const fresh = await localDB.get(id);
        return localDB.putAttachment(id, 'photo', fresh._rev, blob, mime);
      }
      throw err;
    });
    await refresh();
    return id;
  };

  const upload = async (file: File | Blob) => {
    const mime = (file as any).type || 'image/jpeg';
    const id = await saveLocal(file, mime);
    // If online, the live sync will push automatically; for eager push, try remote directly
    if (isOnline) {
      try {
        const doc = await remoteDB.get(id).catch(async () => {
          const base: PhotoDoc = { _id: id, type: 'modB_test', createdAt: new Date().toISOString(), status: 'synced' };
          await remoteDB.put(base);
          return remoteDB.get(id);
        });
        await remoteDB.putAttachment(id, 'photo', (doc as any)._rev, file, mime);
      } catch (e) {
        // fallback to sync
        console.warn('[ModuleB] direct remote upload failed, will sync later', e);
      }
    }
    await refresh();
  };

  const takePhoto = () => {
    // Simple approach: trigger file input with camera capture hint
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    (input as any).capture = 'environment';
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) upload(f);
    };
    input.click();
  };

  const openFile = (id: string) => async () => {
    try {
      const file = await localDB.getAttachment(id, 'photo');
      if (!isAttachmentValue(file)) {
        throw new Error('Unsupported attachment format');
      }
      const blob = attachmentToBlob(file);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      console.error('openFile error', e);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm px-2 py-1 rounded border">Estado: {isOnline ? 'Online' : 'Offline'}</span>
        <span className="text-sm px-2 py-1 rounded border">Sync: {syncState}</span>
      </div>
      <div className="flex gap-2">
        <label className="cursor-pointer px-3 py-2 rounded-md border text-sm">
          Subir foto (prueba)
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e)=>{
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
        </label>
        <button className="px-3 py-2 rounded-md border text-sm" onClick={takePhoto}>
          Tomar foto (prueba)
        </button>
      </div>
      <div>
        <h3 className="font-semibold mb-2">Fotos guardadas (módulo B)</h3>
        <ul className="space-y-2">
          {docs.map((d)=> (
            <li key={d._id} className="flex items-center justify-between border rounded p-2">
              <div className="text-sm">
                <div className="font-mono">{d._id}</div>
                <div className="text-xs opacity-70">{d.createdAt}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 border rounded text-xs" onClick={openFile(d._id)}>Ver</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
