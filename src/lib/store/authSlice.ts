// src/lib/store/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import type { User, Role, Permission } from "../types";
import {
  startSync,
  stopSync,
  loginOnlineToCouchDB,
  logoutOnlineSession,
  findUserByEmail,
  initializeDefaultUsers,
  createUser,
  guardarUsuarioOffline,
  getCouchSession,
  updateUserProfileRole,
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

// --- Helpers de tipado para permissions ---
const ALL_PERMISSIONS: Permission[] = [
  "read",
  "write",
  "delete",
  "manage_users", // agrega más si tu tipo Permission tiene otros literales
];

function isPermission(x: unknown): x is Permission {
  return typeof x === "string" && (ALL_PERMISSIONS as string[]).includes(x);
}

/**
 * Normaliza un arreglo cualquiera a Permission[].
 * Si no viene nada, asigna por rol:
 *  - manager: read, write, delete, manage_users
 *  - admin:   read, write, delete
 *  - user:    read
 */
function normalizePermissions(input: unknown, role: Role): Permission[] {
  if (Array.isArray(input)) {
    const p = input.filter(isPermission);
    if (p.length > 0) return p;
  }
  if (role === "manager") return ["read", "write", "delete", "manage_users"];
  if (role === "admin") return ["read", "write", "delete"];
  return ["read"];
}

export const loadUserFromStorage = createAsyncThunk("auth/load", async () => {
  try {
    const rawUser =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_user")
        : null;
    const rawTok =
      typeof window !== "undefined"
        ? window.localStorage.getItem("auth_token")
        : null;
    if (rawUser && rawTok) {
      return { user: JSON.parse(rawUser) as User, token: rawTok };
    }
  } catch {}
  return null;
});

// Login: siempre toma el rol desde /_session de CouchDB
export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }: LoginCredentials, { rejectWithValue }) => {
    try {
      // 0) Login en Couch (crea cookie AuthSession)
      await loginOnlineToCouchDB(email, password);

      // 0.1) Siembra inicial (no interrumpe en caso de fallo)
      await initializeDefaultUsers().catch(() => {});

      // 1) Rol real desde CouchDB /_session
      let effectiveRole: Role = "user";
      try {
        const sess: any = await getCouchSession();
        const r: string[] = sess?.userCtx?.roles ?? [];
        effectiveRole = r.includes("manager")
          ? "manager"
          : r.includes("admin")
          ? "admin"
          : "user";
      } catch {
        // si no se pudo leer sesión, mantenemos 'user' como fallback
      }

      // 2) Busca perfil local
      let dbUser: any = await findUserByEmail(email);

      // 3) Crea perfil local si no existe (con el rol real)
      if (!dbUser) {
        dbUser = await createUser({
          // OJO: tu createUser NO acepta 'type', por eso no lo enviamos aquí
          name: email.split("@")[0],
          email,
          role: effectiveRole,
          permissions: normalizePermissions(undefined, effectiveRole),
          isActive: true,
        } as any);
      } else if (dbUser.role !== effectiveRole) {
        // 4) Si existe pero trae rol viejo, sincroniza localmente
        dbUser = await updateUserProfileRole(email, effectiveRole);
      }

      // Seguridad TS: si por alguna razón siguiera nulo
      if (!dbUser) {
        throw new Error("No se pudo crear/leer el perfil local del usuario");
      }

      // 5) Guarda verificador offline con roles reales (para tu flujo offline)
      await guardarUsuarioOffline({
        email: dbUser.email,
        name: dbUser.name,
        role: effectiveRole,
      });

      // 6) Construir un User COMPLETO para la UI (cumpliendo con tu tipo `User`)
      const nowIso = new Date().toISOString();

      const derivedPermissions: Permission[] = normalizePermissions(
        dbUser.permissions,
        effectiveRole
      );

      const uiUser: User = {
        id: String(dbUser.id ?? dbUser._id ?? `user:${email}`),
        name: String(dbUser.name ?? email.split("@")[0]),
        email,
        role: effectiveRole,
        permissions: derivedPermissions,
        isActive:
          typeof dbUser.isActive === "boolean" ? dbUser.isActive : true,
        createdAt: String(dbUser.createdAt ?? nowIso),
        updatedAt: nowIso,
        type: "user_profile", // <-- requerido por tu interfaz User
        _id: dbUser._id,
        _rev: dbUser._rev,
      };

      if (typeof window !== "undefined") {
        window.localStorage.setItem("auth_user", JSON.stringify(uiUser));
        window.localStorage.setItem("auth_token", "cookie");
      }

      try {
        startSync();
      } catch {}

      return { user: uiUser, token: "cookie" };
    } catch (err: any) {
      return rejectWithValue(err?.message || "Error de autenticación");
    }
  }
);

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  try {
    await logoutOnlineSession();
  } catch {}
  try {
    stopSync();
  } catch {}
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
    clearError: (state) => {
      state.error = null;
    },
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
    builder.addCase(
      loginUser.fulfilled,
      (state, action: PayloadAction<{ user: User; token: string }>) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.isLoading = false;
        state.error = null;
      }
    );
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
