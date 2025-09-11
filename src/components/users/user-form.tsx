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
  const [modAPerm, setModAPerm] = useState<"FULL" | "READ" | "NONE">(user?.modulePermissions?.MOD_A ?? "NONE");
  const [modBPerm, setModBPerm] = useState<"FULL" | "READ" | "NONE">(user?.modulePermissions?.MOD_B ?? "NONE");
  const [modCPerm, setModCPerm] = useState<"FULL" | "READ" | "NONE">(user?.modulePermissions?.MOD_C ?? "NONE");
  const [modDPerm, setModDPerm] = useState<"FULL" | "READ" | "NONE">(user?.modulePermissions?.MOD_D ?? "NONE");

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
      setModAPerm("FULL");
      setModBPerm("FULL");
      setModCPerm("FULL");
      setModDPerm("FULL");
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
              const defaultsMP = { MOD_A: "NONE", MOD_B: "NONE", MOD_C: "NONE", MOD_D: "NONE" } as const;
              const oldMP = { ...defaultsMP, ...(user.modulePermissions || {}) } as any;
              const newMP = {
                MOD_A: data.role === "manager" ? "FULL" : modAPerm,
                MOD_B: data.role === "manager" ? "FULL" : modBPerm,
                MOD_C: data.role === "manager" ? "FULL" : modCPerm,
                MOD_D: data.role === "manager" ? "FULL" : modDPerm,
              } as any;
              const moduleChanged = JSON.stringify(oldMP) !== JSON.stringify(newMP);

              const changed =
                user.name !== data.name ||
                user.email !== data.email ||
                user.role !== data.role ||
                JSON.stringify((user.permissions ?? []).slice().sort()) !==
                  JSON.stringify((data.permissions ?? []).slice().sort()) ||
                !!(data.password && data.password.trim().length > 0) ||
                moduleChanged;

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

            const payload: any = {
              ...data,
              modulePermissions: {
                MOD_A: role === "manager" ? "FULL" : modAPerm,
                MOD_B: role === "manager" ? "FULL" : modBPerm,
                MOD_C: role === "manager" ? "FULL" : modCPerm,
                MOD_D: role === "manager" ? "FULL" : modDPerm,
              },
            };
            // Mantener permissions como arreglo (v1) y enviar modulePermissions (v2)
            onSubmit(payload as any);
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
          </div>{/* --- Gestión de permisos (Módulos) --- */}
<details className="group mt-6 rounded-2xl border bg-card/60 backdrop-blur-sm shadow-sm">
  <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none">
    <div className="flex items-center gap-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full"></span>
      <div>
        <p className="text-sm font-semibold">Gestión de permisos</p>
        <p className="text-xs text-muted-foreground">Configura el acceso por módulo para este usuario</p>
      </div>
    </div>
    <span className="text-sm text-muted-foreground transition-transform group-open:rotate-180">▾</span>
  </summary>
  <div className="border-t p-5 space-y-4">
    <div className="rounded-xl border bg-background/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Módulo A</p>
          <p className="text-xs text-muted-foreground">Define permisos</p>
        </div>
        <select
          className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          value={modAPerm}
          onChange={(e) => setModAPerm(e.target.value as any)}
          disabled={role === "manager"}
        >
          <option value="FULL">Acceso completo</option>
          <option value="READ">Solo lectura</option>
          <option value="NONE">Sin permiso</option>
        </select>
      </div>
      {role === "manager" && (
        <p className="mt-2 text-xs text-muted-foreground">Este usuario es Manager: el acceso al Módulo A es completo por defecto.</p>
      )}
    </div>
    <div className="rounded-xl border bg-background/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Módulo B</p>
          <p className="text-xs text-muted-foreground">Define permisos</p>
        </div>
        <select
          className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          value={modBPerm}
          onChange={(e) => setModBPerm(e.target.value as any)}
          disabled={role === "manager"}
        >
          <option value="FULL">Acceso completo</option>
          <option value="READ">Solo lectura</option>
          <option value="NONE">Sin permiso</option>
        </select>
      </div>
      {role === "manager" && (
        <p className="mt-2 text-xs text-muted-foreground">Este usuario es Manager: el acceso al Módulo B es completo por defecto.</p>
      )}
    </div>
    <div className="rounded-xl border bg-background/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Módulo C</p>
          <p className="text-xs text-muted-foreground">Define permisos</p>
        </div>
        <select
          className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          value={modCPerm}
          onChange={(e) => setModCPerm(e.target.value as any)}
          disabled={role === "manager"}
        >
          <option value="FULL">Acceso completo</option>
          <option value="READ">Solo lectura</option>
          <option value="NONE">Sin permiso</option>
        </select>
      </div>
      {role === "manager" && (
        <p className="mt-2 text-xs text-muted-foreground">Este usuario es Manager: el acceso al Módulo C es completo por defecto.</p>
      )}
    </div>
    <div className="rounded-xl border bg-background/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Módulo D</p>
          <p className="text-xs text-muted-foreground">Define permisos</p>
        </div>
        <select
          className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          value={modDPerm}
          onChange={(e) => setModDPerm(e.target.value as any)}
          disabled={role === "manager"}
        >
          <option value="FULL">Acceso completo</option>
          <option value="READ">Solo lectura</option>
          <option value="NONE">Sin permiso</option>
        </select>
      </div>
      {role === "manager" && (
        <p className="mt-2 text-xs text-muted-foreground">Este usuario es Manager: el acceso al Módulo D es completo por defecto.</p>
      )}
    </div>
  </div>
</details>


        </form>
      </CardContent>
    </Card>
  );
}
