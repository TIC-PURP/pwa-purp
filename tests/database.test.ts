// Mock PouchDB and pouchdb-find before importing the module under test
jest.mock('pouchdb', () => {
  const PouchDBMock = jest.fn();
  (PouchDBMock as any).plugin = jest.fn();
  return { __esModule: true, default: PouchDBMock };
});
jest.mock('pouchdb-find', () => ({ __esModule: true, default: jest.fn() }));

describe('database', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_COUCHDB_URL = 'http://localhost:5984/gestion_pwa';
    // stub global fetch to avoid network calls
    (global as any).fetch = jest.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
  });

  it('startSync starts replication only once', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const syncHandler = { on: jest.fn().mockReturnThis(), cancel: jest.fn() };
    const localDB = { sync: jest.fn(() => syncHandler) };
    const remoteDB = {};
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const db = await import('@/lib/database');
    const first = await db.startSync();
    expect(localDB.sync).toHaveBeenCalledTimes(1);
    expect(first).toBe(syncHandler);

    const second = await db.startSync();
    expect(localDB.sync).toHaveBeenCalledTimes(1);
    expect(second).toBe(syncHandler);
  });

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

  it('updateUser throws if identifier is missing', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const localDB = { get: jest.fn(), put: jest.fn(), sync: jest.fn() };
    const remoteDB = {};
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const db = await import('@/lib/database');
    await expect(db.updateUser({} as any)).rejects.toThrow('updateUser: falta identificador');
  });
});
