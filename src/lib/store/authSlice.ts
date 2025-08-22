// src/lib/store/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { User } from "../types";
import {
  authenticateUser,
  startSync,
  stopSync,
  loginOnlineToCouchDB,
  logoutOnlineSession,
  guardarUsuarioOffline,
  findUserByEmail, // ← debe existir en ../database
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
  isLoading: true, // esperamos la rehidratación al arrancar
  error: null,
};

export interface LoginCredentials {
  email: string; // puede ser email o usuario
  password: string;
}

function persistSession(user: User | null, token: string | null) {
  if (typeof window === "undefined") return;
  if (user && token) {
    window.localStorage.setItem("auth", JSON.stringify({ user, token }));
  } else {
    window.localStorage.removeItem("auth");
  }
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export const loadUserFromStorage = createAsyncThunk("auth/load", async () => {
  if (typeof window === "undefined") return { user: null, token: null };
  try {
    const raw = window.localStorage.getItem("auth");
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw);
    return { user: parsed.user as User, token: parsed.token as string };
  } catch {
    return { user: null, token: null };
  }
});

export const loginUser = createAsyncThunk<
  { user: User; token: string }, // ← payload de éxito tipado
  LoginCredentials
>("auth/login", async ({ email, password }, { rejectWithValue }) => {
  try {
    // 1) Login ONLINE (crea cookie AuthSession)
    await loginOnlineToCouchDB(email, password);

    // 2) Intentar obtener el usuario REAL desde DB (por email)
    const now = new Date().toISOString();
    const dbUser: any = await findUserByEmail(email);

    // 3) Mapear a tu tipo `User` (sin campo `type`)
    const user: User = dbUser
      ? {
          _id: dbUser._id ?? `user_${email}`,
          id: dbUser.id ?? `user_${email}`,
          name:
            dbUser.name ?? (email.includes("@") ? email.split("@")[0] : email),
          email: dbUser.email ?? email,
          password: dbUser.password ?? password, // ⚠️ en prod: hashear
          role: dbUser.role ?? "user",
          permissions: Array.isArray(dbUser.permissions)
            ? dbUser.permissions
            : ["read"],
          isActive: dbUser.isActive !== false,
          createdAt: dbUser.createdAt ?? now,
          updatedAt: now,
        }
      : {
          _id: `user_${email}`,
          id: `user_${email}`,
          name: email.includes("@") ? email.split("@")[0] : email,
          email,
          password, // ⚠️ en prod: hashear
          role: "user",
          permissions: ["read"],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

    // 4) Guardar/actualizar en Pouch local (offline-first)
    await guardarUsuarioOffline(user);

    // 5) Reiniciar sync (usará la cookie recién creada)
    try {
      await stopSync();
    } catch {}
    try {
      await startSync();
    } catch {}

    // 6) Persistir sesión leyendo token de la cookie AuthSession
    const token = getCookie("AuthSession") || "";
    persistSession(user, token);
    return { user, token };
  } catch (onlineErr: any) {
    const errorMessage = onlineErr?.message || "No se pudo iniciar sesión";
    // Fallback OFFLINE (sin red o sin cookie pero con usuario local)
    const offline = await authenticateUser(email, password);
    if (offline) {
      const user = offline as User;
      persistSession(user, "offline");
      return { user, token: "offline" };
    }
    return rejectWithValue(errorMessage);
  }
});

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  try {
    await stopSync();
  } catch {}
  try {
    await logoutOnlineSession();
  } catch {}
  if (typeof document !== "undefined") {
    document.cookie = "AuthSession=; Max-Age=0; path=/;";
  }
  persistSession(null, null);
  return true;
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      // Persistimos también en localStorage con el token actual (si existe)
      if (typeof window !== "undefined") {
        const token = state.token ?? "cookie-session";
        window.localStorage.setItem(
          "auth",
          JSON.stringify({ user: action.payload, token }),
        );
      }
    },

    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Rehidratación al cargar
      .addCase(loadUserFromStorage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadUserFromStorage.fulfilled, (state, action) => {
        const { user, token } = action.payload as any;
        state.user = user;
        state.token = token;
        state.isAuthenticated = Boolean(user && token);
        state.isLoading = false;
      })
      .addCase(loadUserFromStorage.rejected, (state) => {
        state.isLoading = false;
      })
      // Login
      .addCase(
        loginUser.fulfilled,
        (state, action: PayloadAction<{ user: User; token: string }>) => {
          state.isLoading = false;
          state.isAuthenticated = true;
          state.user = action.payload.user;
          state.token = action.payload.token;
        },
      )
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error =
          (action.payload as string) ||
          action.error.message ||
          "Error de login";
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.error = null;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
