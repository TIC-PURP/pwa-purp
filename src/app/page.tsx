"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import { startSync, stopSync } from "@/lib/database";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  // Inicia/para el sync según el estado de autenticación
  useEffect(() => {
    if (isAuthenticated) {
      startSync().catch(() => {});
    } else {
      stopSync().catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push("/principal");
      } else {
        router.push("/auth/login");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-900"></div>
    </div>
  );
}
