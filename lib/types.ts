// lib/types.ts
export type Role = 'manager' | 'administrador' | 'user';

export type Permission =
  | 'users_read'
  | 'users_write'
  | 'users_delete'
  | 'app_access';

export interface User {
  _id?: string;
  _rev?: string;
  id: string;
  type: 'user';
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: Role;
  permissions: Permission[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}
