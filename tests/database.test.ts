// Pruebas para las utilidades de base de datos basadas en PouchDB
// Se mockean PouchDB y pouchdb-find antes de importar el módulo real
jest.mock('pouchdb', () => {
  const PouchDBMock = jest.fn();
  (PouchDBMock as any).plugin = jest.fn();
  return { __esModule: true, default: PouchDBMock };
});
jest.mock('pouchdb-find', () => ({ __esModule: true, default: jest.fn() }));

describe('database', () => {
  // Restablece mocks y variables de entorno antes de cada prueba
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_COUCHDB_URL = 'http://localhost:5984/gestion_pwa';
    // Stub de fetch global para evitar peticiones reales
    (global as any).fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' })
    );
    try {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => true,
      });
    } catch {
      Object.defineProperty(window, 'navigator', {
        value: { onLine: true },
        configurable: true,
      });
    }
  });

  // startSync debe iniciar la replicación solo una vez
  it('startSync starts replication only once', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const syncHandler = { on: jest.fn().mockReturnThis(), cancel: jest.fn() };
    const localDB = { sync: jest.fn(() => syncHandler) };
    const remoteDB = {};
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const db = await import('@/lib/database');
    const first = await db.startSync();
    expect(localDB.sync).toHaveBeenCalledTimes(1);
    expect(localDB.sync).toHaveBeenCalledWith(remoteDB, expect.objectContaining({ live: true, retry: true }));
    expect(first).toBe(syncHandler);

    const second = await db.startSync();
    expect(localDB.sync).toHaveBeenCalledTimes(1);
    expect(second).toBe(syncHandler);
  });

  it('createUser almacena solo en local cuando no hay conexión', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const store: Record<string, any> = {};
    const localDB = {
      get: jest.fn(async () => {
        throw { status: 404 };
      }),
      put: jest.fn(async (doc: any) => {
        store[doc._id] = doc;
        return { ok: true };
      }),
      sync: jest.fn(),
    };
    const remoteDB = { put: jest.fn() };
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    try {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });
    } catch {}

    const { createUser } = await import('@/lib/database');
    const now = new Date().toISOString();
    const result = await createUser({
      name: 'Offline user',
      email: 'offline@example.com',
      password: 'Secret123*',
      permissions: ['read'],
      role: 'user',
      createdAt: now,
      updatedAt: now,
    });

    expect(remoteDB.put).not.toHaveBeenCalled();
    expect(localDB.put).toHaveBeenCalledTimes(1);
    expect(result.___writePath).toBe('local');
    expect(store['user:offline-example.com']).toBeDefined();
    expect((global as any).fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/admin/couch/users'), expect.anything());
  });

  it('createUser sincroniza con la base remota cuando vuelve la conexión', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const store: Record<string, any> = {};
    const localDB = {
      get: jest.fn(async () => {
        throw { status: 404 };
      }),
      put: jest.fn(async (doc: any) => {
        store[doc._id] = doc;
        return { ok: true };
      }),
      sync: jest.fn(),
    };
    const remoteDB = {
      put: jest.fn(async (doc: any) => ({ ok: true, rev: '2-remote', doc })),
    };
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}), text: async () => '{}' });

    const { createUser } = await import('@/lib/database');
    const result = await createUser({
      name: 'Online user',
      email: 'online@example.com',
      password: 'Secret123*',
      permissions: ['read'],
      role: 'manager',
    });

    expect(remoteDB.put).toHaveBeenCalledTimes(1);
    expect(localDB.put).toHaveBeenCalledTimes(1);
    expect(result.___writePath).toBe('remote');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/couch/users',
      expect.objectContaining({ method: 'POST' })
    );
  });

  // updateUser debe modificar un documento existente
  it('updateUser updates existing user document', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const existing = {
      _id: 'user:alice',
      _rev: '1',
      type: 'user',
      id: 'user_alice',
      name: 'Alice',
      email: 'alice@example.com',
      password: 'pass',
      role: 'user',
      permissions: ['read'],
      isActive: true,
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    } as any;
    const store: Record<string, any> = { [existing._id]: existing };
    const localDB = {
      get: jest.fn(async (id: string) => store[id]),
      put: jest.fn(async (doc: any) => {
        store[doc._id] = doc;
        return { ok: true };
      }),
      sync: jest.fn(),
    };
    const remoteDB = {};
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const db = await import('@/lib/database');
    const result = await db.updateUser(existing._id, { name: 'Alice B' });
    expect(result.name).toBe('Alice B');
    expect(localDB.put).toHaveBeenCalled();
    expect(store[existing._id].name).toBe('Alice B');
  });

  // updateUser debe lanzar error si falta el identificador
  it('updateUser throws if identifier is missing', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const localDB = { get: jest.fn(), put: jest.fn(), sync: jest.fn() };
    const remoteDB = {};
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const db = await import('@/lib/database');
    await expect(db.updateUser({} as any)).rejects.toThrow('updateUser: falta identificador');
  });

  it('updateUser actualiza en local y espera replicación cuando está offline', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const existing = {
      _id: 'user:manager',
      _rev: '1-local',
      type: 'user',
      name: 'Manager',
      email: 'manager@example.com',
      password: 'Secret123*',
      role: 'manager',
      permissions: ['read'],
      modulePermissions: { MOD_A: 'READ', MOD_B: 'NONE', MOD_C: 'NONE', MOD_D: 'NONE' },
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any;
    const store: Record<string, any> = { [existing._id]: { ...existing } };
    const localDB = {
      get: jest.fn(async (id: string) => {
        const doc = store[id];
        if (!doc) throw { status: 404 };
        return { ...doc };
      }),
      put: jest.fn(async (doc: any) => {
        store[doc._id] = doc;
        return { ok: true };
      }),
      sync: jest.fn(),
    };
    const remoteDB = { put: jest.fn() };
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    try {
      Object.defineProperty(window.navigator, 'onLine', {
        configurable: true,
        get: () => false,
      });
    } catch {}

    const { updateUser } = await import('@/lib/database');
    const result = await updateUser(existing._id, {
      modulePermissions: { MOD_B: 'FULL' },
      permissions: ['read', 'write'],
    });

    expect(remoteDB.put).not.toHaveBeenCalled();
    expect(localDB.put).toHaveBeenCalled();
    expect(result.___writePath).toBe('local');
    expect(store[existing._id].modulePermissions.MOD_B).toBe('FULL');
    expect(store[existing._id].permissions).toContain('write');
    expect((global as any).fetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/admin/couch/users'), expect.anything());
  });

  it('updateUser propaga cambios a CouchDB y _users cuando hay conexión', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const existing = {
      _id: 'user:manager',
      _rev: '1-local',
      type: 'user',
      name: 'Manager',
      email: 'manager@example.com',
      password: 'Secret123*',
      role: 'manager',
      permissions: ['read'],
      modulePermissions: { MOD_A: 'READ', MOD_B: 'NONE', MOD_C: 'NONE', MOD_D: 'NONE' },
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any;
    const store: Record<string, any> = { [existing._id]: { ...existing } };
    const localDB = {
      get: jest.fn(async (id: string) => ({ ...store[id] })),
      put: jest.fn(async (doc: any) => {
        store[doc._id] = doc;
        return { ok: true };
      }),
      sync: jest.fn(),
    };
    const remoteDB = {
      put: jest.fn(async () => ({ ok: true, rev: '2-remote' })),
    };
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({}), text: async () => '{}' });

    const { updateUser } = await import('@/lib/database');
    const result = await updateUser(existing._id, {
      role: 'admin',
      modulePermissions: { MOD_B: 'FULL' },
      permissions: ['read', 'write', 'manage_users'],
    });

    expect(remoteDB.put).toHaveBeenCalledTimes(1);
    expect(localDB.put).toHaveBeenCalled();
    expect(result.___writePath).toBe('remote');
    expect(result._rev).toBe('2-remote');
    expect(store[existing._id].role).toBe('admin');
    const adminCall = fetchMock.mock.calls.find(([url, opts]) => {
      const method = opts && (opts as any).method;
      return String(url).includes('/api/admin/couch/users') && (method === 'POST' || method === 'PUT');
    });
    expect(adminCall).toBeTruthy();
  });

  it('updateUser al desactivar conserva la cuenta remota y marca isActive=false', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const existing = {
      _id: 'user:john',
      _rev: '3-local',
      type: 'user',
      name: 'John',
      email: 'john@example.com',
      password: 'Secret123*',
      role: 'manager',
      permissions: ['read'],
      modulePermissions: { MOD_A: 'READ', MOD_B: 'NONE', MOD_C: 'NONE', MOD_D: 'NONE' },
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any;
    const store: Record<string, any> = { [existing._id]: { ...existing } };
    const localDB = {
      get: jest.fn(async (id: string) => ({ ...store[id] })),
      put: jest.fn(async (doc: any) => {
        store[doc._id] = doc;
        return { ok: true };
      }),
      sync: jest.fn(),
    };
    const remoteDB = {
      put: jest.fn(async () => ({ ok: true, rev: '4-remote' })),
    };
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const fetchMock = (global as any).fetch as jest.Mock;
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' });

    const { updateUser } = await import('@/lib/database');
    await updateUser(existing._id, {
      isActive: false,
    });

    const deleteCall = fetchMock.mock.calls.find(([url, opts]) => String(url).includes('/api/admin/couch/users') && (opts as any)?.method === 'DELETE');
    expect(deleteCall).toBeUndefined();

    const putCall = fetchMock.mock.calls.find(([url, opts]) => String(url).includes('/api/admin/couch/users') && (opts as any)?.method === 'PUT');
    expect(putCall).toBeTruthy();
    const body = putCall ? JSON.parse((putCall[1] as any).body) : null;
    expect(body).toBeTruthy();
    expect(body.isActive).toBe(false);
    expect(Array.isArray(body.roles) ? body.roles : []).toContain('inactive');
  });

  it('deleteUserById handles email and legacy identifiers', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const store: Record<string, any> = {
      'user:john@example.com': { _id: 'user:john@example.com', type: 'user' },
      'user:jane-example.com': { _id: 'user:jane-example.com', type: 'user' },
    };
    const removed: string[] = [];
    const localDB = {
      get: jest.fn(async (id: string) => {
        if (store[id]) return store[id];
        throw { status: 404 };
      }),
      remove: jest.fn(async (doc: any) => {
        removed.push(doc._id);
        delete store[doc._id];
        return { ok: true };
      }),
      find: jest.fn(),
    };
    const remoteDB = {};
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const { deleteUserById, openDatabases } = await import('@/lib/database');
    await openDatabases();

    await expect(deleteUserById('john@example.com')).resolves.toBe(true);
    await expect(deleteUserById('user:jane-example.com')).resolves.toBe(true);

    expect(localDB.get).toHaveBeenCalledWith('user:john-example.com');
    expect(localDB.get).toHaveBeenCalledWith('user:jane-example.com');
    expect(removed).toEqual(['user:john@example.com', 'user:jane-example.com']);
  });

  it('deleteUserById falls back to find lookup', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const store: Record<string, any> = {
      legacy123: { _id: 'legacy123', type: 'user', email: 'legacy@example.com' },
    };
    const localDB = {
      get: jest.fn(async () => { throw { status: 404 }; }),
      remove: jest.fn(async (doc: any) => {
        delete store[doc._id];
        return { ok: true };
      }),
      find: jest.fn(async () => ({ docs: [store.legacy123] })),
    };
    const remoteDB = {};
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const { deleteUserById, openDatabases } = await import('@/lib/database');
    await openDatabases();

    await expect(deleteUserById('legacy@example.com')).resolves.toBe(true);
    expect(localDB.find).toHaveBeenCalledWith({ selector: { type: 'user', email: 'legacy@example.com' }, limit: 1 });
    expect(localDB.remove).toHaveBeenCalledWith(expect.objectContaining({ _id: 'legacy123' }));
  });
});
