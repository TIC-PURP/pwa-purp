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

export const permissionLevelValues = ["none","read","all"] as const
export const permissionLevelEnum = z.enum(permissionLevelValues)

export const baseUserSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Formato de correo inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Debe tener 1 mayúscula, 1 minúscula, 1 número y 1 carácter especial"
    ),
  role: z.enum(["manager","administrador","user"]),
  permissionLevel: permissionLevelEnum,
})

export const createUserSchema = baseUserSchema

export const editUserSchema = baseUserSchema.extend({
  password: z.string().optional(),
})
