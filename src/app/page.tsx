"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import { startSync, stopSync } from "@/lib/database";

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  // Arranca/Detiene sync según autenticación
  useEffect(() => {
    if (isAuthenticated) {
      startSync();
    } else {
      stopSync();
    }
  }, [isAuthenticated]);

  // Redirección basada en estado de auth
  useEffect(() => {
    if (!isLoading) {
      router.push(isAuthenticated ? "/principal" : "/auth/login");
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-900"></div>
    </div>
  );
}
