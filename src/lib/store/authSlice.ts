// src/lib/store/authSlice.ts
// Slice de Redux encargado de la autenticación de usuarios
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

// Guarda o elimina la sesión en localStorage
function persistSession(user: User | null, token: string | null) {
  if (typeof window === "undefined") return;
  if (user && token) {
    window.localStorage.setItem("auth", JSON.stringify({ user, token }));
  } else {
    window.localStorage.removeItem("auth");
  }
}

// Obtiene una cookie simple del navegador
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
    console.log("[authSlice] loginUser start", email);
    // 1) Login ONLINE (crea cookie AuthSession)
    await loginOnlineToCouchDB(email, password);

    // 2) Intentar obtener el usuario REAL desde DB (por email)
    const now = new Date().toISOString();
    const dbUser: any = await findUserByEmail(email);
    console.log("[authSlice] findUserByEmail", dbUser ? "found" : "null");

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
    console.log("[authSlice] saved user offline", user._id);

    // 5) Reiniciar sync (usará la cookie recién creada)
    try {
      await stopSync();
    } catch {}
    try {
      await startSync();
    } catch {}

    // 6) Persistir sesión leyendo token de la cookie AuthSession
    // Si la cookie no es accesible (HttpOnly), usamos un token simbólico
    const token = getCookie("AuthSession") || "cookie-session";
    persistSession(user, token);
    console.log("[authSlice] login success", { user: user.email, token });
    return { user, token };
  } catch (onlineErr: any) {
    console.error("[authSlice] loginUser error", onlineErr);
    const errorMessage = onlineErr?.message || "No se pudo iniciar sesión";
    // Fallback OFFLINE (sin red o si localDB no está listo)
    let offline: any = null;
    try {
      offline = await authenticateUser(email, password);
    } catch (err) {
      console.error("[authSlice] offline auth error", err);
    }
    console.log("[authSlice] offline fallback", offline ? "success" : "fail");
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
