import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../types";
import {
  authenticateUser,
  startSync,
  stopSync,
  loginOnlineToCouchDB,
  logoutOnlineSession,
  guardarUsuarioOffline,
  findUserByEmail,
  initializeDefaultUsers,
} from "../database";

export interface AuthState {
  user: User | null;
  token: string | null;              // "online" | "offline"
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
export type LoginCredentials = { email: string; password: string };

const STORAGE_KEY = "purp_auth";
const persist = (u: User, t: string) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u, token: t })); } catch {} };
const clear   = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} };

const initialState: AuthState = { user: null, token: null, isAuthenticated: false, isLoading: false, error: null };

export const loadUserFromStorage = createAsyncThunk("auth/load", async () => {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return { user: null, token: null };
        const parsed = JSON.parse(raw); return { user: parsed.user as User, token: parsed.token as string };
  } catch { return { user: null, token: null }; }
});

export const loginUser = createAsyncThunk<{ user: User; token: string }, LoginCredentials>(
  "auth/login",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      console.log("[auth] login start (cookie-session)");
      // 1) crea sesión Couch con la CUENTA TÉCNICA (admin) que ya viste en Network
      await loginOnlineToCouchDB(email, password);

      // 2) resuelve usuario de la APP (doc user_*)
      const now = new Date().toISOString();
      const dbUser: any = await findUserByEmail(email);
      const user: User = dbUser ? {
        _id: dbUser._id ?? `user_${email}`,
        id: dbUser.id ?? `user_${email}`,
        name: dbUser.name ?? (email.includes("@") ? email.split("@")[0] : email),
        email: dbUser.email ?? email,
        password: dbUser.password ?? password,
        role: dbUser.role ?? "user",
        permissions: Array.isArray(dbUser.permissions) ? dbUser.permissions : ["read"],
        isActive: dbUser.isActive !== false,
        createdAt: dbUser.createdAt ?? now,
        updatedAt: now,
      } : {
        _id: `user_${email}`,
        id: `user_${email}`,
        name: email.includes("@") ? email.split("@")[0] : email,
        email,
        password,
        role: "user",
        permissions: ["read"],
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };

      try { await guardarUsuarioOffline(user); } catch {}

      // 3) arranca sync (retorna enseguida)
      await startSync();

      // 4) persistir y devolver (ESTE return hace que el thunk se resuelva)
      persist(user, "online");
      console.log("[auth] login resolved -> online", user.email);
      return { user, token: "online" };
    } catch (err: any) {
      // fallback OFFLINE
      try { await initializeDefaultUsers(); } catch {}
      const off = await authenticateUser(email, password);
      if (off) {
        persist(off as User, "offline");
        console.log("[auth] login resolved -> offline", (off as User).email);
        return { user: off as User, token: "offline" };
      }
      console.error("[auth] login rejected", err?.message);
      return rejectWithValue(err?.message || "No se pudo iniciar sesión");
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  try { await stopSync(); } catch {}
  try { await logoutOnlineSession(); } catch {}
  clear();
});

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError(s) { s.error = null; },
    setUser(s, a: PayloadAction<User | null>) { s.user = a.payload; s.isAuthenticated = !!a.payload; },
  },
  extraReducers: (b) => {
    b.addCase(loadUserFromStorage.pending,   (s) => { s.isLoading = true; });
    b.addCase(loadUserFromStorage.fulfilled, (s, a) => {
      s.isLoading = false; s.user = a.payload.user; s.token = a.payload.token; s.isAuthenticated = !!a.payload.user;
    });
    b.addCase(loadUserFromStorage.rejected,  (s) => { s.isLoading = false; });

    b.addCase(loginUser.pending,   (s) => { s.isLoading = true; s.error = null; });
    b.addCase(loginUser.fulfilled, (s, a) => {
      s.isLoading = false; s.user = a.payload.user; s.token = a.payload.token; s.isAuthenticated = true;
    });
    b.addCase(loginUser.rejected,  (s, a) => {
      s.isLoading = false; s.error = (a.payload as string) || "Error de autenticación";
    });

    b.addCase(logoutUser.fulfilled, (s) => {
      s.user = null; s.token = null; s.isAuthenticated = false; s.isLoading = false; s.error = null;
    });
  },
});

export const { clearError, setUser } = slice.actions;
export default slice.reducer;
