import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../types";
import {
  authenticateUser,
  startSync,
  stopSync,
  loginOnlineToCouchDB,
  logoutOnlineSession,
  findUserByEmail,
  initializeDefaultUsers,
} from "../database";

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export type LoginCredentials = { email: string; password: string; };

const STORAGE_KEY = "purp_auth";
const persist = (u: User, t: string) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, token: t })); } catch {} };
const clear = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} };

export const loadUserFromStorage = createAsyncThunk("auth/load", async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return { user: data.user as User, token: data.token as string };
  } catch {
    return null;
  }
});

export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }: LoginCredentials, { rejectWithValue }) => {
    try {
      // ONLINE: valida en CouchDB y arranca sync
      await loginOnlineToCouchDB(email, password);
      await initializeDefaultUsers(); // por si hay semillas
      let dbUser = await findUserByEmail(email);
      if (!dbUser) {
        // usuario mínimo si aún no existe en tu colección de negocio
        const now = new Date().toISOString();
        dbUser = {
          id: `user_${Date.now()}`,
          name: email.includes("@") ? email.split("@")[0] : email,
          email,
          role: "user",
          permissions: ["read"],
          isActive: true,
          createdAt: now,
          updatedAt: now,
          type: "user_profile"
        } as User;
      }
      // Guardar verificador OFFLINE (solo local, no sincroniza)
      try {
        const { saveOfflineVerifier } = await import("@/lib/auth/offline");
        await saveOfflineVerifier(email, password, Array.isArray(dbUser.permissions) ? dbUser.permissions : []);
      } catch {}
      const token = "online";
      persist(dbUser, token);
      try { await startSync(); } catch {}
      return { user: dbUser, token };
    } catch (err: any) {
      // OFFLINE fallback
      try {
        const off = await authenticateUser(email, password);
        if (off) {
          const token = "offline";
          persist(off, token);
          return { user: off as User, token };
        }
      } catch {}
      return rejectWithValue(err?.message || "No se pudo iniciar sesión");
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  try { await stopSync(); } catch {}
  try { await logoutOnlineSession(); } catch {}
  clear();
});

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setUser: (state, action: PayloadAction<User | null>) => { state.user = action.payload; state.isAuthenticated = !!action.payload; }
  },
  extraReducers: (builder) => {
    const b = builder as any;
    b.addCase(loadUserFromStorage.fulfilled, (s: AuthState, a: any) => {
      if (a.payload) { s.user = a.payload.user; s.token = a.payload.token; s.isAuthenticated = true; }
    });
    b.addCase(loginUser.pending,    (s: AuthState) => { s.isLoading = true; s.error = null; });
    b.addCase(loginUser.fulfilled,  (s: AuthState, a: any) => { s.isLoading = false; s.user = a.payload.user; s.token = a.payload.token; s.isAuthenticated = true; });
    b.addCase(loginUser.rejected,   (s: AuthState, a: any) => { s.isLoading = false; s.error = (a.payload as string) || "Error de autenticación"; });
    b.addCase(logoutUser.fulfilled, (s: AuthState) => { s.user = null; s.token = null; s.isAuthenticated = false; s.isLoading = false; s.error = null; });
  },
});

export const { clearError, setUser } = slice.actions;
export default slice.reducer;
