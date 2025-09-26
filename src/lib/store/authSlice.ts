// src/lib/store/authSlice.ts
// Slice de Redux encargado de la autenticación de usuarios
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { User, Role } from "../types";
import {
  authenticateUser,
  startSync,
  stopSync,
  loginOnlineToCouchDB,
  logoutOnlineSession,
  guardarUsuarioOffline,
  findUserByEmail,
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
  isLoading: true,
  error: null,
};

export interface LoginCredentials {
  email: string; // puede ser email o usuario
  password: string;
}

function persistSession(user: User | null, token: string | null) {
  if (typeof window === "undefined") return;
  if (user && token) {
    const toStore: any = { ...user };
    if ("avatarUrl" in toStore) {
      delete toStore.avatarUrl;
    }
    window.localStorage.setItem("auth", JSON.stringify({ user: toStore, token }));
  } else {
    window.localStorage.removeItem("auth");
  }
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function toRole(val: any): Role {
  return val === "admin" || val === "manager" || val === "user" ? val : "user";
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
  { user: User; token: string },
  LoginCredentials
>("auth/login", async ({ email, password }, { rejectWithValue }) => {
  try {
    // Si no hay conexión, intentar autenticación local (offline-first)
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (isOffline) {
      const local = await authenticateUser(email, password);
      if (!local) {
        return rejectWithValue("Credenciales inválidas para modo sin conexión.");
      }
      const now = new Date().toISOString();
      const defaultsMP = { MOD_A: "NONE", MOD_B: "NONE", MOD_C: "NONE", MOD_D: "NONE" } as const;
      const mapped: User = {
        _id: local._id ?? `user_${email}`,
        id: local.id ?? `user_${email}`,
        name: local.name ?? (email.includes("@") ? email.split("@")[0] : email),
        email: local.email ?? email,
        password: local.password ?? password,
        role: toRole((local as any)?.role),
        permissions: Array.isArray(local.permissions) ? local.permissions : ["read"],
        modulePermissions: {
          ...defaultsMP,
          ...(local && local.modulePermissions && typeof local.modulePermissions === "object" && !Array.isArray(local.modulePermissions)
            ? local.modulePermissions
            : (!Array.isArray((local as any)?.permissions) && typeof (local as any)?.permissions === "object"
                ? (local as any).permissions
                : {})),
        } as any,
        isActive: local.isActive !== false,
        createdAt: local.createdAt ?? now,
        updatedAt: now,
      };
      try { await guardarUsuarioOffline(mapped as any); } catch {}
      persistSession(mapped, "offline-session");
      return { user: mapped, token: "offline-session" };
    }

    // 1) Login ONLINE (cookie AuthSession) con fallback local ante error de red
    let sessionInfo: any = null;
    try {
      sessionInfo = await loginOnlineToCouchDB(email, password);
    } catch (err: any) {
      const raw = String(err?.message || "");
      const looksNetwork = /network|fetch|aborted|timeout|failed|conexi[óo]n|internet/i.test(raw);
      if (looksNetwork) {
        const local = await authenticateUser(email, password);
        if (local) {
          const now = new Date().toISOString();
          const defaultsMP = { MOD_A: "NONE", MOD_B: "NONE", MOD_C: "NONE", MOD_D: "NONE" } as const;
          const mapped: User = {
            _id: local._id ?? `user_${email}`,
            id: local.id ?? `user_${email}`,
            name: local.name ?? (email.includes("@") ? email.split("@")[0] : email),
            email: local.email ?? email,
            password: local.password ?? password,
            role: toRole((local as any)?.role),
            permissions: Array.isArray(local.permissions) ? local.permissions : ["read"],
            modulePermissions: {
              ...defaultsMP,
              ...(local && local.modulePermissions && typeof local.modulePermissions === "object" && !Array.isArray(local.modulePermissions)
                ? local.modulePermissions
                : (!Array.isArray((local as any)?.permissions) && typeof (local as any)?.permissions === "object"
                    ? (local as any).permissions
                    : {})),
            } as any,
            isActive: local.isActive !== false,
            createdAt: local.createdAt ?? now,
            updatedAt: now,
          };
          try { await guardarUsuarioOffline(mapped as any); } catch {}
          persistSession(mapped, "offline-session");
          return { user: mapped, token: "offline-session" };
        }
      }
      throw err;
    }
    const sessionRoles: string[] = Array.isArray(sessionInfo?.roles) ? sessionInfo.roles : [];

    // 2) Obtener usuario real desde DB local (después de login) por email
    const now = new Date().toISOString();
    const dbUser: any = await findUserByEmail(email);

    // 3) Mapear User y normalizar modulePermissions A–D
    const sessionRole = sessionRoles.includes("admin")
      ? "admin"
      : sessionRoles.includes("manager")
      ? "manager"
      : null;
    const resolvedRole: Role = toRole(sessionRole ?? dbUser?.role);

    const defaultsMP = { MOD_A: "NONE", MOD_B: "NONE", MOD_C: "NONE", MOD_D: "NONE" } as const;
    const mapped: User = dbUser
      ? {
          _id: dbUser._id ?? `user_${email}`,
          id: dbUser.id ?? `user_${email}`,
          name: dbUser.name ?? (email.includes("@") ? email.split("@")[0] : email),
          email: dbUser.email ?? email,
          password: dbUser.password ?? password,
          role: resolvedRole,
          permissions: Array.isArray(dbUser.permissions) ? dbUser.permissions : ["read"],
          modulePermissions: {
            ...defaultsMP,
            ...(dbUser && dbUser.modulePermissions && typeof dbUser.modulePermissions === "object" && !Array.isArray(dbUser.modulePermissions)
              ? dbUser.modulePermissions
              : (!Array.isArray(dbUser?.permissions) && typeof dbUser?.permissions === "object"
                  ? (dbUser as any).permissions
                  : {})),
          } as any,
          isActive: dbUser.isActive !== false,
          createdAt: dbUser.createdAt ?? now,
          updatedAt: now,
        }
      : {
          _id: `user_${email}`,
          id: `user_${email}`,
          name: email.includes("@") ? email.split("@")[0] : email,
          email,
          password,
          role: resolvedRole,
          permissions: ["read"],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };

    // 4) Guardar local y arrancar sync (no await para no bloquear)
    try { await guardarUsuarioOffline(mapped as any); } catch {}
    try { startSync(); } catch {}

    // 5) Persistir sesión
    const token = getCookie("AuthSession") || "cookie-session";
    persistSession(mapped, token);
    return { user: mapped, token };
  } catch (onlineErr: any) {
    const raw = String(onlineErr?.message || "").toLowerCase();
    let friendly = "";
    if (!raw || /network|fetch|aborted|timeout|failed/i.test(raw)) {
      friendly = "No hay conexión a internet. Revisa tu conexión e inténtalo nuevamente.";
    } else if (/unauthorized|forbidden|invalid|incorrect|denied|login failed/i.test(raw)) {
      friendly = "Correo o contraseña incorrectos.";
    } else {
      friendly = onlineErr?.message || "No pudimos iniciar sesión. Inténtalo otra vez.";
    }
    return rejectWithValue(friendly);
  }
});

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  try { await stopSync(); } catch {}
  try { await logoutOnlineSession(); } catch {}
  if (typeof document !== "undefined") {
    document.cookie = "AuthSession=; Max-Age=0; path=/;";
  }
  // Limpieza de caches del SW al cerrar sesión para evitar fugas entre usuarios
  if (typeof caches !== "undefined") {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {}
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
      if (typeof window !== "undefined") {
        const token = state.token ?? "cookie-session";
        const toStore: any = { ...action.payload };
        if ("avatarUrl" in toStore) {
          delete toStore.avatarUrl;
        }
        window.localStorage.setItem("auth", JSON.stringify({ user: toStore, token }));
      }
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserFromStorage.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadUserFromStorage.fulfilled, (state, action) => {
        const { user, token } = action.payload as any;
        const defaultsMP = { MOD_A: "NONE", MOD_B: "NONE", MOD_C: "NONE", MOD_D: "NONE" } as const;
        const normalized = user
          ? {
              ...user,
              permissions: Array.isArray((user as any).permissions) ? (user as any).permissions : [],
              modulePermissions: {
                ...defaultsMP,
                ...(((user as any).modulePermissions && typeof (user as any).modulePermissions === "object" && !Array.isArray((user as any).modulePermissions))
                  ? (user as any).modulePermissions
                  : (!Array.isArray((user as any).permissions) && typeof (user as any).permissions === "object"
                    ? (user as any).permissions
                    : {})),
              } as any,
            }
          : null;
        state.user = normalized as any;
        state.token = token;
        state.isAuthenticated = Boolean(normalized && token);
        state.isLoading = false;
      })
      .addCase(loadUserFromStorage.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<{ user: User; token: string }>) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = (action.payload as string) || action.error.message || "Error de login";
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
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
