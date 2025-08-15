// src/app/users/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RouteGuard } from "@/components/auth/route-guard";
import { Navbar } from "@/components/layout/navbar";
import { UserForm } from "@/components/users/user-form";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setUser } from "@/lib/store/authSlice";
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUserById,
  guardarUsuarioOffline,
} from "@/lib/database";
import type { User, CreateUserData } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, UserPlus, UserPen, UserX, Trash2 } from "lucide-react";

/** Evita SSG en build; se renderiza dinámico (SSR/CSR) */
export const dynamic = "force-dynamic";

export default function UsersPage() {
  const dispatch = useAppDispatch();
  const { user: me } = useAppSelector((s) => s.auth);

  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard" | "activate">("soft");
  const [isLoading, setIsLoading] = useState(false);

  const loadUsers = async () => {
    const all = await getAllUsers();
    setUsers(all);
  };

  useEffect(() => {
    loadUsers().catch(() => {});
  }, []);

  const handleCreateUser = async (data: CreateUserData) => {
    setIsLoading(true);
    try {
      const created: any = await createUser(data);
      const path = created?.___writePath === "remote" ? "remote" : "local";
      if (path === "remote") toast.success("Usuario creado y guardado en la nube.");
      else toast.message("Usuario creado offline; se subirá al recuperar Internet.");

      const createdEmail = (created?.email || data.email || "").toLowerCase();
      const meEmail = (me?.email || "").toLowerCase();
      if (me && createdEmail && createdEmail === meEmail) {
        const mapped = {
          ...me,
          ...created,
          isActive: created.isActive !== false,
          createdAt: created.createdAt ?? me.createdAt,
          updatedAt: created.updatedAt ?? new Date().toISOString(),
        } as any;
        try { await guardarUsuarioOffline(mapped); } catch {}
        dispatch(setUser(mapped));
      }

      await loadUsers();
      setShowForm(false);
      setEditingUser(null);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo crear el usuario.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = async (data: CreateUserData) => {
    if (!editingUser) return;
    setIsLoading(true);
    try {
      const updated: any = await updateUser({ ...editingUser, ...data });
      const path = updated?.___writePath === "remote" ? "remote" : "local";
      if (path === "remote") toast.success("Usuario actualizado en la nube.");
      else toast.message("Usuario actualizado offline; se subirá al recuperar Internet.");
      await loadUsers();
      setEditingUser(null);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar el usuario.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    setIsLoading(true);
    try {
      const toggleTo = !user.isActive;
      const updated: any = await updateUser({
        ...user,
        isActive: toggleTo,
        deletedAt: toggleTo ? undefined : new Date().toISOString(),
      });
      const path = updated?.___writePath === "remote" ? "remote" : "local";
      if (toggleTo) {
        if (path === "remote") toast.success("Usuario activado en la nube.");
        else toast.message("Usuario activado offline; se subirá al recuperar Internet.");
      } else {
        if (path === "remote") toast.success("Usuario desactivado en la nube.");
        else toast.message("Usuario desactivado offline; se subirá al recuperar Internet.");
      }
      await loadUsers();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo cambiar el estado del usuario.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsLoading(true);
    try {
      if (deleteMode === "soft") {
        const updated: any = await updateUser({
          ...deletingUser,
          isActive: false,
          deletedAt: new Date().toISOString(),
        });
        const path = updated?.___writePath === "remote" ? "remote" : "local";
        if (path === "remote") toast.success("Usuario desactivado (borrado lógico) en la nube.");
        else toast.message("Usuario desactivado offline; se subirá al recuperar Internet.");
      } else if (deleteMode === "activate") {
        const updated: any = await updateUser({
          ...deletingUser,
          isActive: true,
          deletedAt: undefined,
        });
        const path = updated?.___writePath === "remote" ? "remote" : "local";
        if (path === "remote") toast.success("Usuario reactivado en la nube.");
        else toast.message("Usuario reactivado offline; se subirá al recuperar Internet.");
      } else {
        const ok = await deleteUserById(
          (deletingUser._id as any) || deletingUser.id || deletingUser.email
        );
        if (ok) {
          if (typeof navigator !== "undefined" && navigator.onLine) {
            toast.success("Usuario eliminado permanentemente en la nube.");
          } else {
            toast.message("Usuario eliminado localmente; se sincronizará al recuperar Internet.");
          }
        } else {
          toast.message("El usuario ya no existe.");
        }
      }

      await loadUsers();
      setDeletingUser(null);
    } catch (error) {
      console.error(error);
      toast.error("No se pudo completar la acción.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <RouteGuard requiredRole="manager">
      <Navbar />
      <div className="container mx-auto p-4 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Usuarios</CardTitle>
              <CardDescription>
                Crea, edita, activa/desactiva y elimina usuarios (offline/online).
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { setShowForm(true); setEditingUser(null); }}>
                <UserPlus className="mr-2 h-4 w-4" /> Nuevo
              </Button>
              <Button variant="outline" onClick={() => loadUsers()}>
                <Plus className="mr-2 h-4 w-4" /> Refrescar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Nombre</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Rol</th>
                    <th className="py-2 pr-4">Activo</th>
                    <th className="py-2 pr-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id || u.id} className="border-b">
                      <td className="py-2 pr-4">{u.name}</td>
                      <td className="py-2 pr-4">{u.email}</td>
                      <td className="py-2 pr-4">{u.role}</td>
                      <td className="py-2 pr-4">
                        {u.isActive !== false ? "Sí" : "No"}
                      </td>
                      <td className="py-2 pr-4 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setEditingUser(u); setShowForm(true); }}
                        >
                          <UserPen className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleUserStatus(u)}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => { setDeletingUser(u); setDeleteMode("hard"); handleDeleteUser(); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={5}>
                        No hay usuarios aún.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingUser ? "Editar usuario" : "Crear usuario"}</CardTitle>
            </CardHeader>
            <CardContent>
              <UserForm
                user={editingUser || undefined}
                onSubmit={editingUser ? handleEditUser : handleCreateUser}
                onCancel={() => { setShowForm(false); setEditingUser(null); }}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </RouteGuard>
  );
}
