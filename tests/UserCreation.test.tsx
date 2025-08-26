// Pruebas para la creación y recuperación de usuarios en la base local
import { User } from '@/lib/types';

// Se mockean las dependencias de PouchDB antes de importar la lógica real
jest.mock('pouchdb', () => {
  const PouchDBMock = jest.fn();
  (PouchDBMock as any).plugin = jest.fn();
  return { __esModule: true, default: PouchDBMock };
});
jest.mock('pouchdb-find', () => ({ __esModule: true, default: jest.fn() }));

describe('Creación de usuarios', () => {
  // Restablece módulos y mocks antes de cada prueba
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_COUCHDB_URL = 'http://localhost:5984/gestion_pwa';
    (global as any).fetch = jest.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
  });

  // Debe insertar un usuario y luego recuperarlo de la base local
  it('crea un usuario y lo recupera de la base de datos local', async () => {
    const PouchDBMock = require('pouchdb').default as jest.Mock;
    const store: Record<string, any> = {};
    const localDB = {
      put: jest.fn(async (doc: any) => {
        store[doc._id] = doc;
        return { ok: true };
      }),
      get: jest.fn(async (id: string) => store[id]),
      createIndex: jest.fn().mockResolvedValue(undefined),
      find: jest.fn(async () => ({ docs: Object.values(store) })),
      sync: jest.fn(),
    };
    const remoteDB = {};
    PouchDBMock.mockImplementationOnce(() => localDB).mockImplementationOnce(() => remoteDB);

    const { createUser, getAllUsers } = await import('@/lib/database');

    const newUser: User = {
      id: '',
      _id: '',
      name: 'Nuevo Usuario',
      email: 'nuevo@purp.com.mx',
      password: 'Test123!',
      role: 'user',
      permissions: ['read'],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createUser(newUser);
    const users = await getAllUsers();
    const found = users.find((u: any) => u.email === newUser.email);
    expect(found).toBeDefined();
    expect(found?.name).toBe('Nuevo Usuario');
  });
});
