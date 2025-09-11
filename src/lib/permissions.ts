// Helpers de permisos por módulo (v2)
import type { User, PermissionLevelV2 } from "./types";

type ModuleKey = "MOD_A" | "MOD_B" | "MOD_C" | "MOD_D";

function moduleMode(user?: User | null, key?: ModuleKey): PermissionLevelV2 {
  if (!user) return "NONE";
  // Solo Manager tiene acceso completo por defecto a todos los módulos.
  // Admin y User dependen estrictamente de modulePermissions asignados por el Manager.
  if (user.role === "manager") return "FULL";
  if (!key) return "NONE";
  return (user.modulePermissions as any)?.[key] ?? "NONE";
}

function canSeeModule(user?: User | null, key?: ModuleKey): boolean {
  const m = moduleMode(user, key);
  return m === "FULL" || m === "READ";
}

// Específicos por módulo (wrappers)
export function moduleAMode(user?: User | null): PermissionLevelV2 {
  return moduleMode(user, "MOD_A");
}
export function moduleBMode(user?: User | null): PermissionLevelV2 {
  return moduleMode(user, "MOD_B");
}
export function moduleCMode(user?: User | null): PermissionLevelV2 {
  return moduleMode(user, "MOD_C");
}
export function moduleDMode(user?: User | null): PermissionLevelV2 {
  return moduleMode(user, "MOD_D");
}

export function canSeeModuleA(user?: User | null): boolean {
  return canSeeModule(user, "MOD_A");
}
export function canSeeModuleB(user?: User | null): boolean {
  return canSeeModule(user, "MOD_B");
}
export function canSeeModuleC(user?: User | null): boolean {
  return canSeeModule(user, "MOD_C");
}
export function canSeeModuleD(user?: User | null): boolean {
  return canSeeModule(user, "MOD_D");
}
