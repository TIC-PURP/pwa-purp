"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createUserSchema, editUserSchema } from "@/lib/validations";
import type { CreateUserData, User, Role, Permission } from "@/lib/types";

const PERMISSION_OPTIONS: Permission[] = [
  "app_access",
  "users_read",
  "users_write",
  "users_delete",
];

export function UserForm({
  user,
  onSubmit,
  onCancel,
  isLoading,
}: {
  user?: User;
  onSubmit: (data: CreateUserData | Partial<CreateUserData>) => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const isEditing = !!user;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateUserData | Partial<CreateUserData>>({
    resolver: zodResolver(isEditing ? editUserSchema : createUserSchema) as any,
    // ⬇⬇⬇ AQUÍ el fix: usar valores válidos para Permission
    defaultValues: isEditing
      ? {
          name: user?.name,
          email: user?.email,
          role: user?.role as Role,
          permissions: user?.permissions as Permission[],
        }
      : {
          name: "",
          email: "",
          password: "",
          role: "user",
          permissions: ["app_access"], // ⬅️ ya no "read"
        },
  });

  const permissions = (watch("permissions") as Permission[]) || [];

  const togglePermission = (p: Permission, checked: boolean) => {
    const current = new Set(permissions);
    if (checked) current.add(p);
    else current.delete(p);
    setValue("permissions", Array.from(current) as any, { shouldValidate: true });
  };

  const submit = handleSubmit(async (data) => {
    // En edición, la contraseña suele ser opcional: limpia si viene vacía
    if (isEditing) {
      const { password, ...rest } = data as CreateUserData;
      await onSubmit(password ? (data as CreateUserData) : (rest as Partial<CreateUserData>));
    } else {
      await onSubmit(data as CreateUserData);
    }
  });

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <Label>Nombre</Label>
        <Input {...register("name")} />
        {errors.name && <p className="text-red-600 text-sm">{String(errors.name.message)}</p>}
      </div>

      <div>
        <Label>Correo</Label>
        <Input type="email" {...register("email")} />
        {errors.email && <p className="text-red-600 text-sm">{String(errors.email.message)}</p>}
      </div>

      {!isEditing && (
        <div>
          <Label>Contraseña</Label>
          <Input type="password" {...register("password")} />
          {errors.password && <p className="text-red-600 text-sm">{String(errors.password.message)}</p>}
        </div>
      )}

      <div>
        <Label>Rol</Label>
        <Select
          defaultValue={(isEditing ? user?.role : "user") as Role}
          onValueChange={(v) => setValue("role", v as Role, { shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">user</SelectItem>
            <SelectItem value="manager">manager</SelectItem>
            <SelectItem value="administrador">administrador</SelectItem>
          </SelectContent>
        </Select>
        {errors.role && <p className="text-red-600 text-sm">{String(errors.role.message)}</p>}
      </div>

      <div>
        <Label>Permisos</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {PERMISSION_OPTIONS.map((p) => (
            <label key={p} className="flex items-center gap-2">
              <Checkbox
                checked={permissions.includes(p)}
                onCheckedChange={(c) => togglePermission(p, Boolean(c))}
              />
              <span className="text-sm">{p}</span>
            </label>
          ))}
        </div>
        {errors.permissions && (
          <p className="text-red-600 text-sm">{String(errors.permissions.message)}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isLoading}>
          {isEditing ? "Guardar cambios" : "Crear usuario"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
