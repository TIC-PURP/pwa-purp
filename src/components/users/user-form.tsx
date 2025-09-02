// Formulario para crear o editar usuarios con validaciones
"use client";

import { useEffect, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";

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
import type { CreateUserData, User, Permission } from "@/lib/types";
import { Eye, EyeOff } from "lucide-react";

// Determina el nivel de acceso según los permisos otorgados
function deriveAccessType(
  perms: Permission[] | undefined,
): "none" | "read_only" | "full" {
  const p = new Set(perms || []);
  if (p.size === 0) return "none";
  if (p.size === 1 && p.has("read")) return "read_only";
  return "full";
}

interface UserFormProps {
  user?: User;
  onSubmit: SubmitHandler<CreateUserData>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function UserForm({
  user,
  onSubmit,
  onCancel,
  isLoading,
}: UserFormProps) {
  const [showPassword, setShowPassword] = useState(false); // Control de visibilidad de contraseña
  const isEditing = !!user; // Indica si se está editando o creando

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues,
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
          // 👉 Crear con "Sin permisos" por defecto
          role: "user",
          permissions: [] as Permission[],
        },
  });

  const role = watch("role");
  const perms = watch("permissions") as Permission[] | undefined;

  // Manager: siempre acceso total y ocultar radios
  useEffect(() => {
    if (role === "manager") {
      const full: Permission[] = ["read", "write", "delete", "manage_users"];
      const current = new Set(perms || []);
      const needsSet =
        full.length !== current.size || full.some((p) => !current.has(p));
      if (needsSet) {
        setValue("permissions", full, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Valor controlado del RadioGroup (derivado de permissions)
  const watchedPermissionLevel = deriveAccessType(perms ?? []);

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
                JSON.stringify((user.permissions ?? []).slice().sort()) !==
                  JSON.stringify((data.permissions ?? []).slice().sort()) ||
                !!(data.password && data.password.trim().length > 0);

              if (!changed) {
                alert(
                  "No se detectaron cambios. No se actualizará el usuario.",
                );
                return;
              }

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
                autoComplete="name"
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
                autoComplete="email"
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
                autoComplete={isEditing ? "new-password" : "new-password"}
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
            <Select
              onValueChange={(value) => {
                const next = value as CreateUserData["role"];
                setValue("role", next, {
                  shouldDirty: true,
                  shouldValidate: true,
                });

                // Si cambio desde manager a otro rol, no imponemos permisos,
                // pero si quedan permisos "no válidos" para admin, los recortamos.
                if (next === "admin") {
                  const current = new Set<Permission>(
                    (getValues("permissions") ?? []) as Permission[],
                  );
                  const clamped = [...current].filter(
                    (p) => p === "read" || p === "write",
                  ) as Permission[];
                  if (clamped.length !== current.size) {
                    setValue("permissions", clamped, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }
                }
              }}
              defaultValue={getValues("role")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuario</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-red-600">{errors.role.message}</p>
            )}
          </div>

          {/* Radios ocultos para manager */}
          {role !== "manager" && (
            <div className="space-y-3">
              <Label>Tipo de Acceso</Label>

              <RadioGroup
                value={watchedPermissionLevel}
                onValueChange={(val) => {
                  let next: Permission[] = [];
                  if (val === "none") next = [];
                  if (val === "read_only") next = ["read"];
                  if (val === "full") {
                    // Admin y Usuario: "Acceso completo" = read + write
                    next = ["read", "write"];
                  }
                  setValue("permissions", next as Permission[], {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
                className="grid gap-3 md:grid-cols-3"
              >
                <div className="flex items-start space-x-3 rounded-xl border p-3">
                  <RadioGroupItem id="perm-none" value="none" />
                  <div className="space-y-1">
                    <Label htmlFor="perm-none" className="font-medium">
                      Sin permisos
                    </Label>
                  </div>
                </div>

                <div className="flex items-start space-x-3 rounded-xl border p-3">
                  <RadioGroupItem id="perm-read" value="read_only" />
                  <div className="space-y-1">
                    <Label htmlFor="perm-read" className="font-medium">
                      Solo lectura
                    </Label>
                  </div>
                </div>

                <div className="flex items-start space-x-3 rounded-xl border p-3">
                  <RadioGroupItem id="perm-full" value="full" />
                  <div className="space-y-1">
                    <Label htmlFor="perm-full" className="font-medium">
                      Acceso completo
                    </Label>
                  </div>
                </div>
              </RadioGroup>

              {errors.permissions && (
                <p className="text-sm text-red-600">
                  {errors.permissions.message}
                </p>
              )}
            </div>
          )}

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
