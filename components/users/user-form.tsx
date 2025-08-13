"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createUserSchema, editUserSchema } from "@/lib/validations";
import type { CreateUserData, User } from "@/lib/types";

type PermissionLevel = "none" | "read" | "all"

type CreateUserFormData = Omit<CreateUserData, "permissions"> & { permissionLevel: PermissionLevel }
import { Eye, EyeOff } from "lucide-react";
import type { SubmitHandler } from "react-hook-form";

const toPermissionsArray = (role: User["role"], level: PermissionLevel): string[] => {
  switch (level) {
    case "none": return []
    case "read": return ["read"]
    case "all":
      if (role === "manager") return ["read","write","delete","manage_users"]
      if (role === "administrador") return ["read","write"]
      return ["write"]
  }
}

const fromPermissionsArray = (role: User["role"], perms: string[]): PermissionLevel => {
  if (!perms || perms.length === 0) return "none"
  if (perms.length === 1 && perms[0] === "read") return "read"
  return "all"
}


interface UserFormProps {
  user?: User;
  onSubmit: SubmitHandler<CreateUserData>;
  onCancel: () => void;
  isLoading?: boolean;
}

const availablePermissions = [
  { id: "read", label: "Lectura" },
  { id: "write", label: "Escritura" },
  { id: "delete", label: "Eliminación" },
  { id: "manage_users", label: "Gestionar Usuarios" },
];

export function UserForm({
  user,
  onSubmit,
  onCancel,
  isLoading,
}: UserFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isEditing = !!user;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(isEditing ? editUserSchema : createUserSchema) as any,
    defaultValues: user
      ? {
          name: user.name,
          email: user.email,
          role: user.role,
          permissionLevel: fromPermissionsArray(user.role, user.permissions),
        }
      : {
          permissionLevel: "read",
        },
  });

  const watchedPermissionLevel = watch("permissionLevel") as PermissionLevel | undefined;
  const watchedRole = watch("role") as User["role"] | undefined;

  // (legacy) handlePermissionChange removed

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {isEditing ? "Editar Usuario" : "Crear Nuevo Usuario"}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? "Modifica la información del usuario existente"
            : "Completa los datos para crear un nuevo usuario"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((data) => {
            const mapped = {
              ...data,
              permissions: toPermissionsArray(data.role, data.permissionLevel),
            };
    
            if (isEditing && user) {
              const changed =
                user.name !== data.name ||
                user.email !== data.email ||
                user.role !== data.role ||
                JSON.stringify(user.permissions.sort()) !==
                  JSON.stringify((mapped.permissions || []).sort()) ||
                (data.password && data.password.trim().length > 0);

              if (!changed) {
                alert(
                  "No se detectaron cambios. No se actualizará el usuario."
                );
                return;
              }

              // Si no se ingresó nueva contraseña, establecer el campo como undefined para evitar sobreescritura con vacío
              if (!data.password || data.password.trim() === "") {
                data.password = "";
              }
            }

            onSubmit(mapped);
          })}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input
                id="name"
                placeholder="Nombre del usuario"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {isEditing ? "Nueva Contraseña (opcional)" : "Contraseña"}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={
                  isEditing ? "Dejar vacío para mantener actual" : "••••••••"
                }
                {...register("password")}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rol del Usuario</Label>
            <Select onValueChange={(value) => setValue("role", value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="administrador">Administrador</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-red-600">{errors.role.message}</p>
            )}
          </div>

          <div className="space-y-3">
            
            <Label>Tipo de Acceso</Label>
            <RadioGroup
              value={watchedPermissionLevel}
              onValueChange={(v) => setValue("permissionLevel", v as PermissionLevel)}
              className="grid gap-3 md:grid-cols-3"
            >
              <div className="flex items-start space-x-3 rounded-xl border p-3">
                <RadioGroupItem id="perm-none" value="none" />
                <div className="space-y-1">
                  <Label htmlFor="perm-none" className="font-medium">Sin permisos</Label>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-xl border p-3">
                <RadioGroupItem id="perm-read" value="read" />
                <div className="space-y-1">
                  <Label htmlFor="perm-read" className="font-medium">Solo lectura</Label>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-xl border p-3">
                <RadioGroupItem id="perm-all" value="all" />
                <div className="space-y-1">
                  <Label htmlFor="perm-all" className="font-medium">Acceso completo</Label>
                </div>
              </div>
            </RadioGroup>

            {errors.permissionLevel && (
              <p className="text-sm text-red-600">{errors.permissionLevel.message}</p>
            )}
    </div>
        
            <div className="flex justify-end space-x-4 mt-6">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? (isEditing ? "Actualizando..." : "Creando...")
                  : (isEditing ? "Actualizar Usuario" : "Crear Usuario")}
              </Button>
            </div>
    
        </form>
      </CardContent>
    </Card>
  );
}
