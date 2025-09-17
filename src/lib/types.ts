// Roles disponibles en el sistema
export type Role = "manager" | "admin" | "user";
// Permisos especificos que puede tener un usuario
export type Permission = "read" | "write" | "delete" | "manage_users";

// --- Nuevos tipos de permisos por modulo (v2)
export type PermissionLevelV2 = "FULL" | "READ" | "NONE";
export interface ModulePermissions {
  MOD_A: PermissionLevelV2;
  [key: string]: PermissionLevelV2;
}

export interface User {
  id: string; // Identificador interno
  name: string; // Nombre completo
  email: string; // Correo electronico
  password: string; // Contrasena en texto plano (solo para demos)
  role: Role; // Rol asignado
  permissions: Permission[]; // Lista de permisos
  modulePermissions?: ModulePermissions; // Permisos por modulo (v2)
  isActive: boolean; // Estado del usuario
  createdAt: string; // Fecha de creacion
  updatedAt: string; // Fecha de ultima actualizacion
  _id?: string; // Campos internos de CouchDB
  _rev?: string;
}

export interface AuthState {
  user: User | null; // Usuario autenticado
  token: string | null; // Token de sesion
  isAuthenticated: boolean; // Bandera de autenticacion
  isLoading: boolean; // Estado de carga
}

export interface LoginCredentials {
  email: string; // Correo de acceso
  password: string; // Contrasena
}

export interface CreateUserData {
  name: string; // Nombre del usuario
  email: string; // Correo electronico
  password: string; // Contrasena
  role: Role; // Rol asignado
  permissions: Permission[]; // Permisos asociados
  modulePermissions?: ModulePermissions; // Permisos por modulo (v2)
}

// Niveles de acceso derivados de los permisos
export type AccessType = "none" | "read_only" | "full";
