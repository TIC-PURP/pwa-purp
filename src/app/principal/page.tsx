// src/app/principal/page.tsx
"use client";

import RouteGuard from "@/components/auth/route-guard";

export default function PrincipalPage() {
  return (
    <RouteGuard>
      <div className="p-4">
        <h1>Página principal protegida</h1>
      </div>
    </RouteGuard>
  );
}
