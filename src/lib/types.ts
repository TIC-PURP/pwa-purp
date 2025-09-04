// Roles disponibles en el sistema
export type Role = "manager" | "admin" | "user";
// Permisos específicos que puede tener un usuario
export type Permission = "read" | "write" | "delete" | "manage_users";

// --- NUEVOS tipos de permisos por módulo (v2)
export type PermissionLevelV2 = "FULL" | "READ" | "NONE";
export interface ModulePermissions {
  MOD_A: PermissionLevelV2;
  [key: string]: PermissionLevelV2;
}


export interface User {
  id: string; // Identificador interno
  name: string; // Nombre completo
  email: string; // Correo electrónico
  password: string; // Contraseña en texto plano (solo para demos)
  role: Role; // Rol asignado
  permissions: Permission[];   modulePermissions?: ModulePermissions; // Permisos por módulo (v2)
// Lista de permisos
  isActive: boolean; // Estado del usuario
  createdAt: string; // Fecha de creación
  updatedAt: string; // Fecha de última actualización
  _id?: string; // Campos internos de CouchDB
  _rev?: string;
}

export interface AuthState {
  user: User | null; // Usuario autenticado
  token: string | null; // Token de sesión
  isAuthenticated: boolean; // Bandera de autenticación
  isLoading: boolean; // Estado de carga
}

export interface LoginCredentials {
  email: string; // Correo de acceso
  password: string; // Contraseña
}

export interface CreateUserData {
  name: string; // Nombre del usuario
  email: string; // Correo electrónico
  password: string; // Contraseña
  role: Role; // Rol asignado
  permissions: Permission[];   modulePermissions?: ModulePermissions; // Permisos por módulo (v2)
// Permisos asociados
}

// Niveles de acceso derivados de los permisos
export type AccessType = "none" | "read_only" | "full";
