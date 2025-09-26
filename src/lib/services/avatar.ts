// src/lib/services/avatar.ts
import type PouchDB from 'pouchdb-browser';
import { userDocId } from '../db/usersRemote';

export async function loadLocalAvatarURL(localDB: PouchDB.Database, docId='profile:me', name='avatar.png') {
  try {
    const blob = await (localDB as any).getAttachment(docId, name);
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function ensureLocalFromRemoteAvatar(
  localDB: PouchDB.Database,
  remoteUsersDB: PouchDB.Database,
  email: string
) {
  const uid = userDocId(email);
  let userDoc: any;
  try {
    userDoc = await (remoteUsersDB as any).get(uid);
  } catch {
    return;
  }
  if (!userDoc || !userDoc._attachments || !userDoc._attachments['avatar.png']) return;

  const blob = await (remoteUsersDB as any).getAttachment(uid, 'avatar.png');
  let profile: any;
  try {
    profile = await (localDB as any).get('profile:me');
  } catch {
    profile = { _id: 'profile:me', userId: email, avatarName: 'avatar.png' };
    await (localDB as any).put(profile);
    profile = await (localDB as any).get('profile:me');
  }
  async function putAttach(rev: string) {
    return (localDB as any).putAttachment('profile:me', 'avatar.png', rev, blob, 'image/png');
  }
  try {
    await putAttach(profile._rev);
  } catch (err: any) {
    if (err.status === 409) {
      const fresh = await (localDB as any).get('profile:me');
      await putAttach(fresh._rev);
    } else {
      throw err;
    }
  }
  const fresh = await (localDB as any).get('profile:me');
  await (localDB as any).put({ ...fresh, avatarRev: fresh._rev });
}

export async function saveAvatar(
  file: File | Blob,
  localDB: PouchDB.Database,
  remoteUsersDB: PouchDB.Database,
  email: string,
  contentType = 'image/png'
) {
  // LOCAL
  let profile: any;
  try {
    profile = await (localDB as any).get('profile:me');
  } catch {
    profile = { _id: 'profile:me', userId: email, avatarName: 'avatar.png' };
    await (localDB as any).put(profile);
    profile = await (localDB as any).get('profile:me');
  }

  async function putLocal(rev: string) {
    return (localDB as any).putAttachment('profile:me', 'avatar.png', rev, file, contentType);
  }

  try {
    await putLocal(profile._rev);
  } catch (err: any) {
    if (err.status === 409) {
      const fresh = await (localDB as any).get('profile:me');
      await putLocal(fresh._rev);
    } else {
      throw err;
    }
  }
  const fresh = await (localDB as any).get('profile:me');
  await (localDB as any).put({ ...fresh, avatarRev: fresh._rev });

  // REMOTO
  const id = userDocId(email);
  try {
    const userDoc = await (remoteUsersDB as any).get(id);
    async function putRemote(rev: string) {
      return (remoteUsersDB as any).putAttachment(id, 'avatar.png', rev, file, contentType);
    }
    try {
      await putRemote(userDoc._rev);
    } catch (err: any) {
      if (err.status === 409) {
        const latest = await (remoteUsersDB as any).get(id);
        await putRemote(latest._rev);
      } else {
        console.warn('[avatar] remote upload deferred', err);
      }
    }
  } catch (e) {
    console.warn('[avatar] remote user doc not available / offline', e);
  }
}

export async function removeAvatar(localDB: PouchDB.Database, remoteUsersDB: PouchDB.Database, email: string) {
  // LOCAL
  try {
    const profile = await (localDB as any).get('profile:me');
    try {
      await (localDB as any).removeAttachment('profile:me', 'avatar.png', profile._rev);
    } catch {}
    const fresh = await (localDB as any).get('profile:me').catch(() => null);
    if (fresh) await (localDB as any).put({ ...fresh, avatarRev: fresh._rev });
  } catch {}

  // REMOTO
  const id = userDocId(email);
  try {
    const doc = await (remoteUsersDB as any).get(id);
    try {
      await (remoteUsersDB as any).removeAttachment(id, 'avatar.png', doc._rev);
    } catch (err: any) {
      if (err.status === 409) {
        const latest = await (remoteUsersDB as any).get(id);
        await (remoteUsersDB as any).removeAttachment(id, 'avatar.png', latest._rev);
      } else {
        console.warn('[avatar] remote delete deferred', err);
      }
    }
  } catch (e) {
    console.warn('[avatar] remote not reachable', e);
  }
}
