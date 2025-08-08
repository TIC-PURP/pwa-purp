import { createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import type { AuthState, LoginCredentials } from "../types"
import { authenticateUser, startSync, stopSync, loginOnlineToCouchDB, guardarUsuarioOffline } from "../database"

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
}

// Thunks asíncronos
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      let user = await authenticateUser(credentials.email, credentials.password)

      // Si no se encuentra localmente, intenta login online
      if (!user) {
        const onlineSuccess = await loginOnlineToCouchDB(credentials.email, credentials.password)

        if (!onlineSuccess) {
          return rejectWithValue("Credenciales inválidas")
        }

        // Iniciar sincronización para traer datos del usuario
        await startSync()

        // Esperar que el usuario sea replicado (opcional pero recomendable)
        let tries = 0
        const maxTries = 10
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

        while (!user && tries < maxTries) {
          await delay(500)
          user = await authenticateUser(credentials.email, credentials.password)
          tries++
        }

        if (!user) {
          return rejectWithValue("Error sincronizando usuario desde CouchDB")
        }
      }

      // 👇 Guardar usuario localmente para permitir login offline
      await guardarUsuarioOffline(user)

      // Generar token simple (en producción usar JWT)
      const token = `token_${user.id}_${Date.now()}`

      // Guardar en localStorage
      localStorage.setItem("auth_token", token)
      localStorage.setItem("auth_user", JSON.stringify(user))

      // Iniciar sincronización (en caso de que aún no se haya llamado)
      startSync()

      return { user, token }
    } catch (error) {
      return rejectWithValue("Error de autenticación")
    }
  },
) 

export const logoutUser = createAsyncThunk("auth/logoutUser", async (_, { dispatch }) => {
  // Limpiar localStorage
  localStorage.removeItem("auth_token")
  localStorage.removeItem("auth_user")

  // Detener sincronización
  stopSync()

  return null
})

export const loadUserFromStorage = createAsyncThunk("auth/loadUserFromStorage", async () => {
  const token = localStorage.getItem("auth_token")
  const userStr = localStorage.getItem("auth_user")

  if (token && userStr) {
    const user = JSON.parse(userStr)
    startSync()
    return { user, token }
  }

  return null
})

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError: (state) => {
      state.isLoading = false
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload.user
        state.token = action.payload.token
        state.isAuthenticated = true
      })
      .addCase(loginUser.rejected, (state) => {
        state.isLoading = false
        state.user = null
        state.token = null
        state.isAuthenticated = false
      })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.isAuthenticated = false
        state.isLoading = false
      })
      // Load from storage
      .addCase(loadUserFromStorage.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload.user
          state.token = action.payload.token
          state.isAuthenticated = true
        }
        state.isLoading = false
      })
  },
})

export const { clearError } = authSlice.actions
export default authSlice.reducer
