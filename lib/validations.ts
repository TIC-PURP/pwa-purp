import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().min(1, "El correo es requerido").email("Formato de correo inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "La contraseña debe contener al menos: 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial"
    ),
})

const availablePermissions = ["read", "write", "delete", "manage_users"] as const
const permissionEnum = z.enum(availablePermissions)

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
  role: z.enum(["manager", "administrador", "user"]),
  permissions: z.array(permissionEnum).min(1, "Selecciona al menos un permiso"),
})

export const createUserSchema = baseUserSchema.refine((data) => {
  const { role, permissions } = data

  if (role === "manager") return true

  if (role === "administrador") {
    return (
      permissions.length <= 2 &&
      permissions.every((p) => p === "read" || p === "write")
    )
  }

  if (role === "user") {
    return (
      permissions.length === 1 &&
      (permissions[0] === "read" || permissions[0] === "write")
    )
  }

  return false
}, {
  message: "Permisos inválidos para el rol seleccionado",
  path: ["permissions"],
})

export const editUserSchema = baseUserSchema
  .extend({
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
  .refine((data) => {
    const { role, permissions } = data

    if (role === "manager") return true

    if (role === "administrador") {
      return (
        permissions.length <= 2 &&
        permissions.every((p) => p === "read" || p === "write")
      )
    }

    if (role === "user") {
      return (
        permissions.length === 1 &&
        (permissions[0] === "read" || permissions[0] === "write")
      )
    }

    return false
  }, {
    message: "Permisos inválidos para el rol seleccionado",
    path: ["permissions"],
  })
