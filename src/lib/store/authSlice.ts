import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../types";
import {
  startSync,
  stopSync,
  loginOnlineToCouchDB,
  logoutOnlineSession,
  findUserByEmail,
  initializeDefaultUsers,
  createUser,
  guardarUsuarioOffline,
} from "../database";

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export type LoginCredentials = { email: string; password: string };

export const loadUserFromStorage = createAsyncThunk(
  "auth/load",
  async () => {
    try {
      const rawUser = typeof window !== "undefined" ? window.localStorage.getItem("auth_user") : null;
      const rawTok  = typeof window !== "undefined" ? window.localStorage.getItem("auth_token") : null;
      if (rawUser && rawTok) {
        return { user: JSON.parse(rawUser) as User, token: rawTok };
      }
    } catch {}
    return null;
  }
);

export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }: LoginCredentials, { rejectWithValue }) => {
    try {
      // 1) Auth on Couch (AuthSession cookie)
      await loginOnlineToCouchDB(email, password);

      // 2) Seed local users (idempotent)
      await initializeDefaultUsers().catch(() => {});

      // 3) Find or create app-level profile
      let dbUser = await findUserByEmail(email);
      if (!dbUser) {
        const now = new Date().toISOString();
        dbUser = await createUser({
          name: email.split("@")[0],
          email,
          role: "user",
          permissions: ["read"],
          isActive: true,
          createdAt: now,
          updatedAt: now,
          type: "user_profile",
        } as Partial<User> as any);
      }

      // 4) Persist lightweight offline verifier (email+password PBKDF2 hash)
      await guardarUsuarioOffline({ email: dbUser.email, name: dbUser.name, role: dbUser.role });

      // 5) Fire-and-forget continuous sync
      try { startSync(); } catch {}

      // 6) Persist session to localStorage
      if (typeof window !== "undefined") {
        window.localStorage.setItem("auth_user", JSON.stringify(dbUser));
        window.localStorage.setItem("auth_token", "cookie");
      }

      return { user: dbUser, token: "cookie" };
    } catch (err: any) {
      const msg = err?.message || "Error de autenticación";
      return rejectWithValue(msg);
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  try { await logoutOnlineSession(); } catch {}
  try { await stopSync(); } catch {}
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("auth_user");
    window.localStorage.removeItem("auth_token");
  }
  return true;
});

const slice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadUserFromStorage.fulfilled, (state, action) => {
      if (action.payload) {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      }
    });
    builder.addCase(loginUser.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state, action: PayloadAction<any>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
    });
    builder.addCase(loginUser.rejected, (state, action: any) => {
      state.isLoading = false;
      state.error = action.payload || "Error de autenticación";
    });
    builder.addCase(logoutUser.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    });
  },
});

export const { clearError, setUser } = slice.actions;
export default slice.reducer;
