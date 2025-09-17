// Página principal del panel accesible tras autenticación
"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { Navbar } from "@/components/layout/navbar";
import { useAppSelector } from "@/lib/hooks";
import { useEffect, useState } from "react";
import { getAllUsers, getAllUsersAsManager } from "@/lib/database";
import {
  Users,
  Folder,
} from "lucide-react";
import Link from "next/link";
import { canSeeModuleA, canSeeModuleB, canSeeModuleC, canSeeModuleD } from "@/lib/permissions";

export default function Principal() {
  // Obtiene el usuario autenticado desde el estado global de la aplicación.
  const { user } = useAppSelector((state) => state.auth);
  // Número de usuarios detectados en la base de datos (null = cargando / error).
  const [activeUsers, setActiveUsers] = useState<number | null>(null);

  // Consulta la cantidad de usuarios visibles para mostrarla en el panel principal.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = user?.role === "manager"
          ? await getAllUsersAsManager()
          : await getAllUsers({ includeInactive: true });
        if (!cancelled) setActiveUsers(Array.isArray(list) ? list.length : 0);
      } catch {
        if (!cancelled) setActiveUsers(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.role]);

  // El guardia de ruta garantiza que solo personas autenticadas vean el panel.
  return (
    <RouteGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">
                Bienvenido, {user?.name}
              </h1>
            </div>

            {/* Contenedor de accesos rápidos a cada módulo disponible */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Panel de control (exclusivo para personas con rol manager) */}
                {user?.role === "manager" && (
                  <Link href="/users" className="block">
                    <div className="rounded-xl border bg-card text-card-foreground p-5 shadow-md hover:shadow-lg transition hover:border-accent">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow">
                          <Users className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            Panel de control
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {activeUsers === null ? "Cargando usuarios..." : `${activeUsers} usuarios en la base`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {/* Enlaces condicionales a los módulos según permisos */}
                {(user?.role === "manager" || canSeeModuleA(user)) && (
                  <Link href="/mod-a" className="block">
                    <div className="rounded-xl border bg-card text-card-foreground p-5 shadow-md hover:shadow-lg transition hover:border-accent">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow">
                          <Folder className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            Módulo A
                          </h3>
                          <p className="text-sm text-muted-foreground">Ir al módulo</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {(user?.role === "manager" || canSeeModuleB(user)) && (
                  <Link href="/mod-b" className="block">
                    <div className="rounded-xl border bg-card text-card-foreground p-5 shadow-md hover:shadow-lg transition hover:border-accent">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow">
                          <Folder className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            Módulo B
                          </h3>
                          <p className="text-sm text-muted-foreground">Ir al módulo</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {(user?.role === "manager" || canSeeModuleC(user)) && (
                  <Link href="/mod-c" className="block">
                    <div className="rounded-xl border bg-card text-card-foreground p-5 shadow-md hover:shadow-lg transition hover:border-accent">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow">
                          <Folder className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            Módulo C
                          </h3>
                          <p className="text-sm text-muted-foreground">Ir al módulo</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

                {(user?.role === "manager" || canSeeModuleD(user)) && (
                  <Link href="/mod-d" className="block">
                    <div className="rounded-xl border bg-card text-card-foreground p-5 shadow-md hover:shadow-lg transition hover:border-accent">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow">
                          <Folder className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            Módulo D
                          </h3>
                          <p className="text-sm text-muted-foreground">Ir al módulo</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                )}

              </div>
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}

