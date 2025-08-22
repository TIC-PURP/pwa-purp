export type Role = "manager" | "admin" | "user";
export type Permission = "read" | "write" | "delete" | "manage_users";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _id?: string;
  _rev?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: Role;
  permissions: Permission[];
}

export type AccessType = "none" | "read_only" | "full";
