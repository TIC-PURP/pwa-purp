// Página de administración de usuarios protegida por autenticación
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
// Importar solo notify para evitar duplicados de estilos
import { notify } from "@/lib/notify";
import { RouteGuard } from "@/components/auth/route-guard";
import { Navbar } from "@/components/layout/navbar";
import { UserForm } from "@/components/users/user-form";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setUser } from "@/lib/store/authSlice";
import { findUserByEmail, guardarUsuarioOffline } from "@/lib/database";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { User, CreateUserData } from "@/lib/types";
import {
  getAllUsers,
  getAllUsersAsManager,
  createUser,
  updateUser,
  softDeleteUser,
  hardDeleteUser,
  cleanupUserDocs,
} from "@/lib/database";
import { Plus, Edit, Trash2, UserX } from "lucide-react";
import BackButton from "@/components/common/back-button";

export default function UsersPage() {
  // Hook de Redux para despachar acciones
  const dispatch = useAppDispatch();
  // Usuario autenticado almacenado globalmente
  const { user: me } = useAppSelector((s) => s.auth);

  const router = useRouter();
  // Lista de usuarios recuperados
  const [users, setUsers] = useState<User[]>([]);
  // Controla la visualización del formulario
  const [showForm, setShowForm] = useState(false);
  // Usuario seleccionado para edición
  const [editingUser, setEditingUser] = useState<User | null>(null);
  // Usuario objetivo de eliminación
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  // Tipo de eliminación a aplicar
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard" | "activate">(
    "soft",
  );
  // Indicador de operación en curso
  const [isLoading, setIsLoading] = useState(false);

  // Cargar usuarios al montar el componente
  useEffect(() => {
    loadUsers();
    // Ejecuta limpieza una sola vez al montar
    (async () => {
      try {
        const n = await cleanupUserDocs();
        if (n > 0) {
          notify.info("Datos actualizados en segundo plano");
          await loadUsers();
        }
      } catch {}
    })();
  }, []);

  // Obtiene todos los usuarios de la base local o remota
  const loadUsers = async () => {
    // Manager: listar desde _users + fusionar locales. Otros (por si cambia guard): solo locales
    const allUsers = me?.role === "manager"
      ? await getAllUsersAsManager()
      : await getAllUsers({ includeInactive: true });
    setUsers(allUsers as any);
  };

  // Crea un nuevo usuario y sincroniza según la conexión
  const handleCreateUser = async (data: CreateUserData) => {
    setIsLoading(true);
    try {
      const created: any = await createUser(data);
      const path = created?.___writePath === "remote" ? "remote" : "local";
      if (path === "remote")
        notify.success("Usuario guardado en la nube");
      else
        notify.info(
          "Usuario guardado sin conexión. Se sincronizará cuando haya internet",
        );

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
        try {
          await guardarUsuarioOffline(mapped);
        } catch {}
        dispatch(setUser(mapped));
      }

      await loadUsers();
      setShowForm(false);
      setEditingUser(null);
    } catch (error) {
      console.error(error);
      notify.error("No se pudo crear el usuario.");
    } finally {
      setIsLoading(false);
    }
  };

  // Actualiza los datos de un usuario existente
  const handleEditUser = async (data: CreateUserData) => {
    if (!editingUser) return;
    setIsLoading(true);
    try {
      const updated: any = await updateUser({ ...editingUser, ...data });
      const path = updated?.___writePath === "remote" ? "remote" : "local";
      if (path === "remote") notify.success("Cambios guardados en la nube");
      else
        notify.info(
          "Cambios guardados sin conexión. Se sincronizarán luego",
        );
      await loadUsers();
      setEditingUser(null);
    } catch (error) {
      console.error(error);
      notify.error("No se pudo actualizar el usuario.");
    } finally {
      setIsLoading(false);
    }
  };

  // Elimina, desactiva o activa un usuario según el modo seleccionado
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
        if (path === "remote")
          notify.success("Usuario desactivado");
        else
          notify.info(
            "Usuario desactivado. Se sincronizará luego",
          );
      } else if (deleteMode === "activate") {
        const updated: any = await updateUser({
          ...deletingUser,
          isActive: true,
          deletedAt: undefined,
        });
        const path = updated?.___writePath === "remote" ? "remote" : "local";
        if (path === "remote") notify.success("Usuario activado");
        else
          notify.info(
            "Usuario activado. Se sincronizará luego",
          );
      } else {
        const ok = await hardDeleteUser(
          deletingUser._id || deletingUser.id || deletingUser.email,
        );
        if (ok) {
          if (typeof navigator !== "undefined" && navigator.onLine) {
            notify.error("Usuario eliminado para siempre");
          } else {
            notify.info(
              "Usuario eliminado. Se sincronizará luego",
            );
          }
        } else {
          notify.info("El usuario ya no existe.");
        }
      }

      await loadUsers();
      setDeletingUser(null);
    } catch (error) {
      console.error(error);
      notify.error("No se pudo completar la acción.");
    } finally {
      setIsLoading(false);
    }
  };

  // Cambia rápidamente el estado activo de un usuario
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
        if (path === "remote") notify.success("Usuario activado");
        else
          notify.info(
            "Usuario activado. Se sincronizará luego",
          );
      } else {
        if (path === "remote") notify.warn("Usuario desactivado");
        else
          notify.info(
            "Usuario desactivado. Se sincronizará luego",
          );
      }
      await loadUsers();
    } catch (error) {
      console.error(error);
      notify.error("No se pudo cambiar el estado del usuario.");
    } finally {
      setIsLoading(false);
    }
  };

  if (showForm || editingUser) {
    return (
      <RouteGuard requiredRole="manager">
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <div className="px-4 py-6 sm:px-0">
              <UserForm
                user={editingUser || undefined}
                onSubmit={editingUser ? handleEditUser : handleCreateUser}
                onCancel={() => {
                  setShowForm(false);
                  setEditingUser(null);
                }}
                isLoading={isLoading}
              />
            </div>
          </main>
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard requiredRole="manager">
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-4">
              <BackButton />
            </div>
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Panel de control
                </h1>
                <p className="mt-2 text-slate-600">Gestión de usuarios</p>
              </div>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Usuario
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {users.map((user) => (
                <Card
                  key={user.id}
                  className={`${!user.isActive ? "opacity-60" : ""}`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{user.name}</CardTitle>
                        <CardDescription>{user.email}</CardDescription>
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!user.isActive}
                          onClick={() => setEditingUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            (me?.role === "manager") &&
                            ((user.email || "").toLowerCase() === (me?.email || "").toLowerCase())
                          }
                          onClick={() => {
                            setDeletingUser(user);
                            setDeleteMode(user.isActive ? "soft" : "activate");
                          }}
                        >
                          <UserX className="h-4 w-4 text-yellow-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={
                            !user.isActive ||
                            ((me?.role === "manager") &&
                              ((user.email || "").toLowerCase() === (me?.email || "").toLowerCase()))
                          }
                          onClick={() => {
                            setDeletingUser(user);
                            setDeleteMode("hard");
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Rol:</span>
                        <Badge
                          variant={
                            user.role === "manager" ? "default" : "secondary"
                          }
                        >
                          {user.role}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Estado:</span>
                        <Badge
                          variant={user.isActive ? "default" : "destructive"}
                        >
                          {user.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-sm text-slate-600">
                          Permisos:
                        </span>

                        <div className="flex flex-wrap gap-1 mt-1">
                          {(() => {
                            const perms = Array.isArray(user.permissions)
                              ? [...user.permissions].sort()
                              : [];
                            let label = "Acceso completo";
                            if (perms.length === 0) label = "Sin permisos";
                            else if (perms.length === 1 && perms[0] === "read")
                              label = "Solo lectura";
                            return (
                              <Badge variant="outline" className="text-xs">
                                {label}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        Creado: {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {users.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-slate-600">No hay usuarios registrados</p>
                  <Button className="mt-4" onClick={() => setShowForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Primer Usuario
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        <AlertDialog
          open={!!deletingUser}
          onOpenChange={() => setDeletingUser(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteMode === "soft"
                  ? "¿Desactivar usuario?"
                  : deleteMode === "activate"
                    ? "¿Activar usuario?"
                    : "¿Eliminar usuario permanentemente?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteMode === "soft"
                  ? `Esta acción desactivará al usuario "${deletingUser?.name}". Podrás reactivarlo después.`
                  : deleteMode === "activate"
                    ? `Esta acción activará nuevamente al usuario "${deletingUser?.name}".`
                    : `Esta acción eliminará permanentemente al usuario "${deletingUser?.name}". No podrás recuperar sus datos.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!deletingUser) return;
                  setIsLoading(true);
                  try {
                    if (deleteMode === "soft") {
                      await softDeleteUser(deletingUser._id || deletingUser.id);
                      notify.warn("Usuario desactivado");
                    } else if (deleteMode === "activate") {
                      await updateUser({ ...deletingUser, isActive: true });
                      notify.success("Usuario activado");
                    } else {
                      await hardDeleteUser(deletingUser._id || deletingUser.id);
                      notify.error("Usuario eliminado permanentemente");
                    }
                    await loadUsers();
                    setDeletingUser(null);
                  } catch (error) {
                    console.error("Error:", error);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
              >
                {isLoading
                  ? deleteMode === "soft"
                    ? "Desactivando..."
                    : deleteMode === "activate"
                      ? "Activando..."
                      : "Eliminando..."
                  : deleteMode === "soft"
                    ? "Desactivar"
                    : deleteMode === "activate"
                      ? "Activar"
                      : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RouteGuard>
  );
}













