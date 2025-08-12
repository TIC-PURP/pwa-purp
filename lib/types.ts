// añade/ajusta estos tipos
export type Role = "manager" | "user" | "administrador";

export type Permission =
  | "app_access"
  | "users_read"
  | "users_write"
  | "users_delete";

export type CreateUserData = {
  name: string;
  email: string;
  password: string;        // requerido al crear
  role: Role;
  permissions: Permission[]; // ⬅️ importante
};

// si ya tienes User aquí, que coincida con database.ts (sin password)
export type User = {
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
};
