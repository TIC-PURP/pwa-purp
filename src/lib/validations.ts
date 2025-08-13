import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "El correo es requerido").email("Formato de correo inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "La contraseña debe contener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial"
    ),
});

// --- Permisos y roles ---
const availablePermissions = ["read", "write", "delete", "manage_users"] as const;
const permissionEnum = z.enum(availablePermissions);
const roleEnum = z.enum(["manager", "administrador", "user"]);

export type Permission = z.infer<typeof permissionEnum>;
export type Role = z.infer<typeof roleEnum>;

const permissionsArray = z.array(permissionEnum).default([]); // permitir vacío por defecto

// --- Esquema base de usuario ---
const baseUserSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Formato de correo inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Debe tener 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial"
    ),
  role: roleEnum,
  permissions: permissionsArray, // sin .min(1): permite crear sin permisos
});

// --- Tipo para el refine (password opcional) ---
type RefineInput = {
  role: Role;
  permissions: Permission[];
  password?: string | undefined;
};

// --- Helper de validación por rol ---
function validatePermissionsByRole(data: RefineInput, ctx: z.RefinementCtx) {
  const { role, permissions } = data;
  const p = new Set(permissions ?? []);

  if (role === "manager") {
    // Manager: debe tener acceso total
    const full: Permission[] = ["read", "write", "delete", "manage_users"];
    const ok = full.every((perm) => p.has(perm)) && p.size === full.length;
    if (!ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El rol 'manager' debe tener acceso completo.",
        path: ["permissions"],
      });
    }
    return;
  }

  // Admin y User:
  // Permitir: [] (sin permisos), ["read"] (solo lectura), ["read","write"] (acceso completo)
  // Rechazar: "delete" o "manage_users"
  for (const perm of p) {
    if (perm !== "read" && perm !== "write") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Permisos no válidos para este rol.",
        path: ["permissions"],
      });
      return;
    }
  }
  if (p.size > 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Acceso completo equivale a lectura y escritura (máximo 2).",
      path: ["permissions"],
    });
  }
}

// --- CREATE ---
export const createUserSchema = baseUserSchema.superRefine((data, ctx) =>
  validatePermissionsByRole(data, ctx)
);

// --- EDIT ---
export const editUserSchema = baseUserSchema
  .extend({
    // en edición la password es opcional
    password: z
      .string()
      .optional()
      .refine((val) => !val || val.length >= 8, {
        message: "La contraseña debe tener al menos 8 caracteres",
      })
      .refine(
        (val) =>
          !val ||
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(val),
        {
          message:
            "Debe tener 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial",
        }
      ),
  })
  .superRefine((data, ctx) => validatePermissionsByRole(data, ctx));
