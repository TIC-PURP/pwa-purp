// Helpers de permisos por módulo (v2)
import type { User, PermissionLevelV2 } from "./types";

export function canSeeModuleA(user?: User | null): boolean {
  if (!user) return false;
  if (user.role === "manager") return true;
  const perm = user.modulePermissions?.MOD_A ?? "NONE";
  return perm === "FULL" || perm === "READ";
}

export function moduleAMode(user?: User | null): PermissionLevelV2 {
  if (!user) return "NONE";
  if (user.role === "manager") return "FULL";
  return user.modulePermissions?.MOD_A ?? "NONE";
}
