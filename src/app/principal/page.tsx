"use client";

import { RouteGuard } from "@/components/auth/route-guard";
import { Navbar } from "@/components/layout/navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppSelector } from "@/lib/hooks";
import { BarChart3, Users, Shield, Activity } from "lucide-react";
import Link from "next/link";

export default function Principal() {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <RouteGuard>
      <div className="min-h-screen bg-slate-50">
        <Navbar />

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900">
                Bienvenido, {user?.name}
              </h1>
            </div>
            {user?.role === "manager" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Link href="/users" className="block">
                  <div className="rounded-xl border bg-white p-5 shadow-md hover:shadow-lg transition hover:border-blue-50">
                    <div className="flex items-center gap-4">
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800">
                          Panel de Control
                        </h3>
                        <p className="text-sm text-slate-600">
                          Gestión de usuarios
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    </RouteGuard>
  );
}
