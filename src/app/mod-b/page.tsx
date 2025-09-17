// Pantalla del Modulo B
"use client";

import { Navbar } from "@/components/layout/navbar";
import { RouteGuard } from "@/components/auth/route-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { moduleBMode } from "@/lib/permissions";
import BackButton from "@/components/common/back-button";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { listPhotos, savePhoto, getPhotoThumbUrl, deletePhoto } from "@/lib/database";

export function PhotosTest() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string,string>>({});

  const camRef = useRef<HTMLInputElement|null>(null);
  const galRef = useRef<HTMLInputElement|null>(null);

  const refresh = async () => {
    const list = await listPhotos({});
    setPhotos(list);
    const map: Record<string,string> = {};
    for (const p of list) {
      try { map[p._id] = await getPhotoThumbUrl(p._id); } catch {}
    }
    setUrls(map);
  };

  useEffect(() => { refresh(); }, []);

  const onPick = async (f?: File|null) => {
    if (!f) return;
    await savePhoto(f, {});
    await refresh();
  };

  const onDelete = async (id: string) => {
    await deletePhoto(id);
    await refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
               onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        <input ref={galRef} type="file" accept="image/*" className="hidden"
               onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
        <Button onClick={() => camRef.current?.click()}>Tomar foto</Button>
        <Button variant="secondary" onClick={() => galRef.current?.click()}>Subir desde galeria</Button>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((p) => (
          <li key={p._id} className="relative group">
            <img src={urls[p._id]} alt={p._id} className="w-full h-32 object-cover rounded-xl border" />
            <button onClick={() => onDelete(p._id)}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded">
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


export default function ModuleBPage() {
  const { user } = useAppSelector((s) => s.auth);
  const router = useRouter();
  const mode = moduleBMode(user); // FULL | READ | NONE

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
          <h1 className="text-xl font-semibold">Modulo B</h1>
          <BackButton />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido al Modulo B</CardTitle>
          </CardHeader>
          <CardContent>
            {mode === "READ" ? (
              <p className="text-sm text-muted-foreground">
                Modo lectura: si existieran formularios, estarian deshabilitados.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Acceso completo.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pruebas de Fotos</CardTitle>
          </CardHeader>
          <CardContent>
            <PhotosTest />
          </CardContent>
        </Card>

      </main>
    </RouteGuard>
  );
}



