// lib/types.ts
export type Role = "manager" | "administrador" | "user";

export type Permission =
  | "users_read"
  | "users_write"
  | "users_delete"
  | "app_access"
  | "read"
  | "write"
  | "delete";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password?: string; // solo para creación / cambio
  role: Role;
  permissions: Permission[];
}

export interface User {
  _id?: string;
  _rev?: string;
  id: string;
  type: "user";
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
