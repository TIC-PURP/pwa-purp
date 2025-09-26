// src/app/modulo-b/pruebas/page.tsx
import React from 'react';
import ModuleBPhotoTest from '@/components/ModuleBPhotoTest';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Módulo B · Pruebas de imágenes (offline/online)</h1>
      <p className="text-sm">Sube o toma una foto. Si estás offline se guardará localmente y al recuperar conexión se sincroniza a la base remota <code>pwa-purp</code>.</p>
      <ModuleBPhotoTest />
    </div>
  );
}
