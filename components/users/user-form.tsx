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
import { Checkbox } from "@/components/ui/checkbox";
import { createUserSchema, editUserSchema } from "@/lib/validations";
import type { CreateUserData, User } from "@/lib/types";
import { Eye, EyeOff } from "lucide-react";
import type { SubmitHandler } from "react-hook-form";

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
  } = useForm<CreateUserData>({
    resolver: zodResolver(isEditing ? editUserSchema : createUserSchema) as any,
    defaultValues: user
      ? {
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
        }
      : {
          permissions: ["read"],
        },
  });

  const watchedPermissions = watch("permissions") || [];

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    const currentPermissions = watchedPermissions;
    if (checked) {
      setValue("permissions", [...currentPermissions, permissionId]);
    } else {
      setValue(
        "permissions",
        currentPermissions.filter((p) => p !== permissionId)
      );
    }
  };

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
            if (isEditing && user) {
              const changed =
                user.name !== data.name ||
                user.email !== data.email ||
                user.role !== data.role ||
                JSON.stringify(user.permissions.sort()) !==
                  JSON.stringify((data.permissions || []).sort()) ||
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

            onSubmit(data);
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
            <Label>Permisos</Label>
            <div className="grid grid-cols-2 gap-3">
              {availablePermissions.map((permission) => (
                <div
                  key={permission.id}
                  className="flex items-center space-x-2"
                >
                  <Checkbox
                    id={permission.id}
                    checked={watchedPermissions.includes(permission.id)}
                    onCheckedChange={(checked) =>
                      handlePermissionChange(permission.id, checked as boolean)
                    }
                  />
                  <Label htmlFor={permission.id} className="text-sm">
                    {permission.label}
                  </Label>
                </div>
              ))}
            </div>
            {errors.permissions && (
              <p className="text-sm text-red-600">
                {errors.permissions.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? isEditing
                  ? "Actualizando..."
                  : "Creando..."
                : isEditing
                ? "Actualizar Usuario"
                : "Crear Usuario"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
