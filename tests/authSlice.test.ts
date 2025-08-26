// Pruebas unitarias para las acciones y reducer de autenticación
import { configureStore } from '@reduxjs/toolkit';
import authReducer, {
  loginUser,
  logoutUser,
  loadUserFromStorage,
} from '@/lib/store/authSlice';
import * as db from '@/lib/database';

// Se mockean las funciones de base de datos para evitar llamadas reales
jest.mock('@/lib/database', () => ({
  authenticateUser: jest.fn(),
  startSync: jest.fn(),
  stopSync: jest.fn(),
  loginOnlineToCouchDB: jest.fn(),
  logoutOnlineSession: jest.fn(),
  guardarUsuarioOffline: jest.fn(),
  findUserByEmail: jest.fn(),
}));

describe('authSlice', () => {
  // Usuario ficticio utilizado en las pruebas
  const sampleUser = {
    _id: 'user_test',
    id: 'user_test',
    name: 'Test',
    email: 'test@example.com',
    password: '123',
    role: 'user',
    permissions: ['read'],
    isActive: true,
    createdAt: 'now',
    updatedAt: 'now',
  } as any;

  // Limpia mocks y almacenamiento local antes de cada caso
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
  });

  // Debe autenticar con la base local cuando falla el login online
  it('login offline falls back to local authentication', async () => {
    (db.loginOnlineToCouchDB as jest.Mock).mockRejectedValue(new Error('offline'));
    (db.authenticateUser as jest.Mock).mockResolvedValue(sampleUser);

    const store = configureStore({ reducer: { auth: authReducer } });
    await store.dispatch(loginUser({ email: sampleUser.email, password: sampleUser.password }) as any);
    const state = store.getState().auth;

    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe(sampleUser.email);
    expect(state.token).toBe('offline');
    expect(window.localStorage.getItem('auth')).toBeTruthy();
  });

  // Al cerrar sesión se limpia el estado y se llama al logout del backend
  it('logout clears session and calls database logout', async () => {
    (db.stopSync as jest.Mock).mockResolvedValue(undefined);
    (db.logoutOnlineSession as jest.Mock).mockResolvedValue(undefined);

    window.localStorage.setItem('auth', JSON.stringify({ user: sampleUser, token: 'token123' }));
    const store = configureStore({
      reducer: { auth: authReducer },
      preloadedState: {
        auth: {
          user: sampleUser,
          token: 'token123',
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
      },
    });

    await store.dispatch(logoutUser() as any);
    const state = store.getState().auth;

    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(window.localStorage.getItem('auth')).toBeNull();
    expect(db.stopSync).toHaveBeenCalled();
    expect(db.logoutOnlineSession).toHaveBeenCalled();
  });

  // Cargar usuario desde localStorage debe hidratar el estado inicial
  it('loadUserFromStorage hydrates state', async () => {
    window.localStorage.setItem('auth', JSON.stringify({ user: sampleUser, token: 'abc123' }));
    const store = configureStore({ reducer: { auth: authReducer } });
    await store.dispatch(loadUserFromStorage());
    const state = store.getState().auth;

    expect(state.user).toEqual(sampleUser);
    expect(state.token).toBe('abc123');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
  });
});
