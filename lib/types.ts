// lib/types.ts

export type Role = "manager" | "administrador" | "user";

export type Permission =
  | "users_read"
  | "users_write"
  | "users_delete"
  | "app_access";

export type CreateUserData = {
  name: string;
  email: string;
  password: string; // solo para alta/edición, NO se guarda en Pouch
  role: Role;
  permissions: Permission[];
};

export type User = {
  // Documento de usuario para la app (sin password)
  id: string;           // ID lógico de tu app
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _id?: string;         // si viene de Couch/Pouch
  _rev?: string;
};
