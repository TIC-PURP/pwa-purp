export interface User {
  id: string
  name: string
  email: string
  password: string
  role: "manager" | "administrador" | "user"
  permissions: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
  _id?: string
  _rev?: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface CreateUserData {
  name: string
  email: string
  password: string
  role: "manager" | "administrador" | "user"
  permissions: string[]
}
