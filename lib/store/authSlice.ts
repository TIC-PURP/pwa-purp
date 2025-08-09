import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import type { AuthState, LoginCredentials, User } from "../types"
import {
  authenticateUser,
  startSync,
  stopSync,
  loginOnlineToCouchDB,
  guardarUsuarioOffline,
  localDB,
} from "../database"

// Estado inicial
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  // @ts-ignore (por si tu tipo no tiene 'error')
  error: null,
}

// Helpers de storage
const saveSession = (payload: { user: User; token: string }) => {
  try {
    localStorage.setItem("auth", JSON.stringify(payload))
  } catch {}
}
const clearSession = () => {
  try {
    localStorage.removeItem("auth")
  } catch {}
}

// LOGIN con fallback offline
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    const { email, password } = credentials
    const online = typeof navigator === "undefined" ? true : navigator.onLine

    // Intento ONLINE si hay red
    if (online) {
      try {
        const ok = await loginOnlineToCouchDB(email, password)
        if (ok) {
          // Si el usuario ya existía local, úsalo; si no, crea/upserta uno base
          let user = await authenticateUser(email, password)
          if (!user) {
            const now = new Date().toISOString()
            user = {
              id: `user_${email}`,
              name: email.split("@")[0],
              email,
              password, // ⚠️ en producción: usa hash (bcryptjs)
              role: "user",
              permissions: ["read"],
              isActive: true,
              createdAt: now,
              updatedAt: now,
              _id: `user_${email}`,
            } as User
            await guardarUsuarioOffline(user)
          } else {
            // Refresca updatedAt y guarda por si cambió algo
            user.updatedAt = new Date().toISOString()
            await guardarUsuarioOffline(user)
          }

          // Arranca sync (si definiste filtros, agrégalos en database.ts)
          try { await startSync() } catch {}

          // Persistencia de sesión
          saveSession({ user, token: "cookie-session" })

          return { user, token: "cookie-session" }
        }
        // Si el servidor rechazó (401) intenta OFFLINE como plan B
      } catch {
        // Ignora: caeremos a offline
      }
    }

    // Fallback OFFLINE (sin red o error online)
    try {
      const offlineUser = await authenticateUser(email, password)
      if (!offlineUser) {
        return rejectWithValue("Sin conexión y no hay sesión previa/local para esas credenciales.")
      }
      saveSession({ user: offlineUser, token: "offline" })
      return { user: offlineUser, token: "offline" }
    } catch (e) {
      return rejectWithValue("No se pudo autenticar offline.")
    }
  }
)

// Cargar sesión desde localStorage al iniciar la app
export const loadUserFromStorage = createAsyncThunk("auth/loadUserFromStorage", async () => {
  try {
    const raw = localStorage.getItem("auth")
    if (!raw) return null
    const parsed = JSON.parse(raw) as { user: User; token: string }
    return parsed
  } catch {
    return null
  }
})

// Logout
export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  try { await stopSync() } catch {}
  clearSession()
  return true
})

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError(state) {
      // @ts-ignore
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true
        // @ts-ignore
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.isAuthenticated = true
        state.user = action.payload.user
        state.token = action.payload.token
      })
      .addCase(loginUser.rejected, (state, action: any) => {
        state.isLoading = false
        state.isAuthenticated = false
        state.user = null
        state.token = null
        // @ts-ignore
        state.error = action.payload || "No se pudo iniciar sesión."
      })

      // load from storage
      .addCase(loadUserFromStorage.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload.user
          state.token = action.payload.token
          state.isAuthenticated = true
        }
        state.isLoading = false
      })

      // logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.isLoading = false
        // @ts-ignore
        state.error = null
      })
  },
})

export const { clearError } = authSlice.actions
export default authSlice.reducer
