// Barra de navegación superior con información del usuario y logout
"use client";

import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { logoutUser } from "@/lib/store/authSlice";
import { useRouter } from "next/navigation";
import { LogOut, User, Users, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export function Navbar() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);

  // Cierra la sesión y redirige al formulario de login
  const handleLogout = async () => {
    await dispatch(logoutUser());
    router.push("/auth/login");
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-slate-900">PWA</h1>
            </div>
            {/* Botonoes de navegación */}
            {/* <div className="flex space-x-4">
              <Link href="/principal">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Principal</span>
                </Button>
              </Link>

              {user?.role === "manager" && (
                <Link href="/users">
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>Panel</span>
                  </Button>
                </Link>
              )}
            </div> */}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-slate-600" />
              <span className="text-sm text-slate-700">{user?.name}</span>
              <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                {user?.role}
              </span>
            </div>

            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
