import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit"
import { localDB, loginOnlineToCouchDB, bootstrapAfterLogin, logoutFromCouchDB, createUser } from "@/lib/database"
import type { User, LoginCredentials, Role, Permission } from "@/lib/types"

function deriveRoleFromEmail(email: string): Role {
  return /manager|admin/i.test(email) ? "manager" : "user"
}

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      await loginOnlineToCouchDB(credentials.email, credentials.password)
      await bootstrapAfterLogin()

      const res: any = await (localDB as any).find({
        selector: { type: "user", email: credentials.email },
        limit: 1,
      })
      let user: User | null = res.docs?.[0] || null

      if (!user) {
        // Si no hay perfil, crea uno básico (se replicará)
        const now = new Date().toISOString()
        user = {
          id: crypto.randomUUID(),
          type: "user",
          name: credentials.email.split("@")[0],
          email: credentials.email,
          role: deriveRoleFromEmail(credentials.email),
          permissions: (deriveRoleFromEmail(credentials.email) === "manager"
            ? ["app_access","users_read","users_write","users_delete"]
            : ["app_access"]) as Permission[],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }
        await createUser(user)
      }

      return user
    } catch (err: any) {
      return rejectWithValue(err?.message || "No se pudo iniciar sesión")
    }
  }
)

export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  await logoutFromCouchDB()
})

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload
      state.isAuthenticated = !!action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false
        state.user = action.payload as User
        state.isAuthenticated = true
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false
        state.error = (action.payload as string) || "Error de autenticación"
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.isAuthenticated = false
      })
  },
})

export const { setUser } = authSlice.actions
export default authSlice.reducer
