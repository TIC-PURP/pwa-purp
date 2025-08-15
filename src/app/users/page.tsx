"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  createUser,
  updateUser,
  softDeleteUser,
  deleteUserById,
} from "@/lib/database";
import {
  Plus,
  Edit,
  Trash2,
  UserX,
  ArrowLeftCircle,
} from "lucide-react";

const dispatch = useAppDispatch();
const { user: me } = useAppSelector((s) => s.auth);

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "hard" | "activate">(
    "soft"
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
  };

  const handleCreateUser = async (data: CreateUserData) => {
    setIsLoading(true);
try {
  // 1) Actualiza el doc
  await updateUser({ ...editingUser, ...data });

  // 2) Si el usuario que acabas de editar ES el usuario en sesión, refresca auth
  const editedEmail = (data.email || editingUser?.email || "").toLowerCase();
  const meEmail = (me?.email || "").toLowerCase();

  if (me && editedEmail && editedEmail === meEmail) {
    const fresh: any = await findUserByEmail(me.email);
    if (fresh) {
      // Mapea al tipo User de tu app
      const mapped = {
        _id: fresh._id ?? me._id,
        id: fresh.id ?? me.id,
        name: fresh.name ?? me.name,
        email: fresh.email ?? me.email,
        password: fresh.password ?? me.password,
        role: fresh.role ?? me.role,
        permissions: Array.isArray(fresh.permissions) ? fresh.permissions : me.permissions,
        isActive: fresh.isActive !== false,
        createdAt: fresh.createdAt ?? me.createdAt,
        updatedAt: fresh.updatedAt ?? new Date().toISOString(),
      };

      // Guarda local y actualiza Redux + localStorage
      await guardarUsuarioOffline(mapped);
      dispatch(setUser(mapped as any));
    }
  }

  // 3) Refresca la tabla y cierra el modal/edición
  await loadUsers();
  setEditingUser(null);
} catch (error) {
  console.error(error);
  // aquí tu manejo de errores/toast
} finally {
  setIsLoading(false);
}

  };

  const handleEditUser = async (data: CreateUserData) => {
    if (!editingUser) return;
    setIsLoading(true);
    try {
      await updateUser({ ...editingUser, ...data });
      await loadUsers();
      setEditingUser(null);
    } catch (error) {
      console.error("Error actualizando usuario:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setIsLoading(true);
    try {
      if (deleteMode === "soft") {
        await softDeleteUser(deletingUser._id || deletingUser.id);
      } else {
        await deleteUserById(deletingUser._id || deletingUser.id);
      }
      await loadUsers();
      toast.success(
        `Usuario eliminado${
          deleteMode === "soft" ? " (desactivado)" : " permanentemente"
        }`
      );
      setDeletingUser(null);
    } catch (error) {
      console.error("Error eliminando usuario:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    setIsLoading(true);
    try {
      await updateUser({ ...user, isActive: !user.isActive });
      await loadUsers();
      toast.success(
        `Usuario ${user.isActive ? "desactivado" : "activado"} correctamente`
      );
    } catch (error) {
      console.error("Error cambiando estado del usuario:", error);
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
            <button
              onClick={() => router.back()}
              className="inline-flex items-center text-slate-600 hover:text-slate-900 transition text-sm mb-4"
            >
              <ArrowLeftCircle className="h-5 w-5 mr-2" />
              <span>Regresar</span>
            </button>
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
                          onClick={() => setEditingUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
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
                            const perms = (user.permissions || []).sort();
                            let label = "Acceso completo";
                            if (perms.length === 0) label = "Sin permisos";
                            else if (perms.length === 1 && perms[0] === "read") label = "Solo lectura";
                            return (
                              <Badge variant="outline" className="text-xs">{label}</Badge>
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
                      toast.success("Usuario desactivado");
                    } else if (deleteMode === "activate") {
                      await updateUser({ ...deletingUser, isActive: true });
                      toast.success("Usuario activado");
                    } else {
                      await deleteUserById(deletingUser._id || deletingUser.id);
                      toast.success("Usuario eliminado permanentemente");
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