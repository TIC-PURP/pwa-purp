// Pantalla del MÃ³dulo C
"use client";

import { Navbar } from "@/components/layout/navbar";
import { RouteGuard } from "@/components/auth/route-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { moduleCMode } from "@/lib/permissions";
import BackButton from "@/components/common/back-button";

export default function ModuleCPage() {
  const { user } = useAppSelector((s) => s.auth);
  const router = useRouter();
  const mode = moduleCMode(user); // FULL | READ | NONE

  useEffect(() => {
    if (mode === "NONE") {
      router.replace("/principal");
    }
  }, [mode, router]);

  if (mode === "NONE") return null;

  return (
    <RouteGuard>
      <Navbar />
      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">MÃ³dulo C</h1>
          <BackButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido al mÃ³dulo C</CardTitle>
          </CardHeader>
          <CardContent>
            {mode === "READ" ? (
              <p className="text-sm text-muted-foreground">
                Modo lectura: si existieran formularios, estarÃ­an deshabilitados.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Acceso completo.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </RouteGuard>
  );
}

