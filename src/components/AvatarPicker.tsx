// src/components/AvatarPicker.tsx
'use client';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import PouchDB from 'pouchdb-browser';
import { getUserLocalDB } from '@/lib/db/userLocal';
import { getUsersRemoteDB } from '@/lib/db/usersRemote';
import { loadLocalAvatarURL, ensureLocalFromRemoteAvatar, saveAvatar, removeAvatar } from '@/lib/services/avatar';

export default function AvatarPicker() {
  const email = useSelector((s: any) => s.auth?.user?.email || s.auth?.email || '');
  const [localDB, setLocalDB] = useState<PouchDB.Database | null>(null);
  const [remoteDB, setRemoteDB] = useState<PouchDB.Database | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [revKey, setRevKey] = useState<string>('0');

  useEffect(() => {
    if (!email) return;
    setLocalDB(getUserLocalDB(email));
    setRemoteDB(getUsersRemoteDB());
  }, [email]);

  const refresh = async () => {
    if (!localDB) return;
    const u = await loadLocalAvatarURL(localDB);
    setImgUrl(prev => { if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev); return u; });
    const profile: any = await (localDB as any).get('profile:me').catch(()=>null);
    setRevKey(profile?.avatarRev || `${Date.now()}`);
  };

  useEffect(() => {
    if (!localDB || !remoteDB || !email) return;
    (async () => {
      const hasLocal = await (localDB as any).get('profile:me')
        .then((d: any)=> !!d._attachments?.['avatar.png'])
        .catch(()=>false);
      if (!hasLocal) {
        await ensureLocalFromRemoteAvatar(localDB, remoteDB, email).catch(()=>{});
      }
      await refresh();
    })();
    return () => { if (imgUrl && imgUrl.startsWith('blob:')) URL.revokeObjectURL(imgUrl); };
  }, [localDB, remoteDB, email]);

  const onChoose = async (file: File) => {
    if (!localDB || !remoteDB || !email) return;
    // TODO: opcional: crop/resize antes de guardar
    await saveAvatar(file, localDB, remoteDB, email, file.type || 'image/png');
    await refresh();
  };

  const onRemove = async () => {
    if (!localDB || !remoteDB || !email) return;
    await removeAvatar(localDB, remoteDB, email);
    await refresh();
  };

  return (
    <div className="flex items-center gap-4">
      <img
        key={revKey}
        src={imgUrl ?? '/avatar-placeholder.svg'}
        alt="avatar"
        className="w-20 h-20 rounded-full object-cover border"
      />
      <div className="flex gap-2">
        <label className="cursor-pointer px-3 py-2 rounded-md border text-sm">
          Cambiar
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onChoose(f);
            }}
          />
        </label>
        <button
          className="px-3 py-2 rounded-md border text-sm"
          onClick={() => {
            // Sugerencia: usar input capture o un modal con getUserMedia
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            (input as any).capture = 'environment';
            input.onchange = () => {
              const f = (input.files && input.files[0]) || null;
              if (f) onChoose(f);
            };
            input.click();
          }}
        >
          Tomar foto
        </button>
        <button className="px-3 py-2 rounded-md border text-sm" onClick={onRemove}>
          Quitar
        </button>
      </div>
    </div>
  );
}
