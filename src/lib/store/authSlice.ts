import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit"
import type { User } from "../types"
import {
  authenticateUser,
  startSync,
  stopSync,
  loginOnlineToCouchDB,
  logoutOnlineSession,
  guardarUsuarioOffline,
} from "../database"

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,            // ⬅️  Arrancamos cargando
  error: null,
}

export interface LoginCredentials {
  email: string // puede ser email o usuario
  password: string
}

function persistSession(user: User | null, token: string | null) {
  if (typeof window === "undefined") return
  if (user && token) {
    window.localStorage.setItem("auth", JSON.stringify({ user, token }))
  } else {
    window.localStorage.removeItem("auth")
  }
}

export const loadUserFromStorage = createAsyncThunk("auth/load", async () => {
  if (typeof window === "undefined") return { user: null, token: null }
  try {
    const raw = window.localStorage.getItem("auth")
    if (!raw) return { user: null, token: null }
    const parsed = JSON.parse(raw)
    return { user: parsed.user as User, token: parsed.token as string }
  } catch {
    return { user: null, token: null }
  }
})

export const loginUser = createAsyncThunk(
  "auth/login",
  async ({ email, password }: LoginCredentials, { rejectWithValue }) => {
    try {
      // 1) Online -> crea cookie AuthSession
      await loginOnlineToCouchDB(email, password)

      // 2) Usuario local (para offline)
      const now = new Date().toISOString()
      const user: User = {
        id: `user_${email}`,
        name: email.includes("@") ? email.split("@")[0] : email,
        email,
        password, // ⚠️ en prod: hashear
        role: "user",
        permissions: ["read"],
        isActive: true,
        createdAt: now,
        updatedAt: now,
        _id: `user_${email}`,
      }
      await guardarUsuarioOffline(user)

      // 3) Sync con cookie
      try { await stopSync() } catch {}
      try { await startSync() } catch {}

      persistSession(user, "cookie-session")
      return { user, token: "cookie-session" }
    } catch (onlineErr: any) {
      // Fallback OFFLINE
      const offline = await authenticateUser(email, password)
      if (offline) {
        const user = offline as User
        persistSession(user, "offline")
        return { user, token: "offline" }
      }
      return rejectWithValue(onlineErr?.message || "No se pudo iniciar sesión")
    }
  }
)

export const logoutUser = createAsyncThunk("auth/logout", async () => {
  try { await stopSync() } catch {}
  try { await logoutOnlineSession() } catch {}
  persistSession(null, null)
  return true
})

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: { clearError(state) { state.error = null } },
  extraReducers: (builder) => {
    builder
      // 🔸 Rehidratación
      .addCase(loadUserFromStorage.pending, (state) => {
        state.isLoading = true
      })
      .addCase(loadUserFromStorage.fulfilled, (state, action) => {
        const { user, token } = action.payload as any
        state.user = user
        state.token = token
        state.isAuthenticated = Boolean(user && token)
        state.isLoading = false                    // ⬅️  ya cargó
      })
      .addCase(loadUserFromStorage.rejected, (state) => {
        state.isLoading = false                    // ⬅️  ya cargó
      })
      // 🔸 Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<{ user: User; token: string }>) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.user = action.payload.user
        state.token = action.payload.token
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false
        state.error = (action.payload as string) || action.error.message || "Error de login"
      })
      // 🔸 Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.isLoading = false
        state.error = null
      })
  },
})

export const { clearError } = authSlice.actions
export default authSlice.reducer
