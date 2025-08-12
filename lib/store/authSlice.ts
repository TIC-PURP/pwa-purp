// lib/store/authSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { AuthState, LoginCredentials, User } from '../types'
import {
  loginOnlineToCouchDB,
  logoutFromCouchDB,
  bootstrapAfterLogin,
  localDB,
} from '../database'

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
}

export const loginUser = createAsyncThunk<User, LoginCredentials>(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      await loginOnlineToCouchDB(email, password)
      await bootstrapAfterLogin()
      // intenta leer perfil
      const res: any = await (localDB as any).find({ selector: { type: 'user', email } })
      let user: User | null = res.docs[0] as User | undefined || null
      if (!user) {
        const now = new Date().toISOString()
        user = {
          id: crypto.randomUUID(),
          type: 'user',
          name: email.split('@')[0],
          email,
          role: 'user',
          permissions: ['app_access'],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }
      }
      return user
    } catch (err: any) {
      return rejectWithValue(err?.message || 'No se pudo iniciar sesión')
    }
  }
)

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await logoutFromCouchDB()
})

const authSlice = createSlice({
  name: 'auth',
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
        state.user = action.payload
        state.isAuthenticated = true
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false
        state.error = (action.payload as string) || 'Error de login'
        state.user = null
        state.isAuthenticated = false
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.isAuthenticated = false
      })
  },
})

export const { setUser } = authSlice.actions
export default authSlice.reducer
