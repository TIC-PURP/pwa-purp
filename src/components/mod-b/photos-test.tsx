"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { listPhotos, savePhoto, getPhotoThumbUrl, deletePhoto } from "@/lib/database";
import { useAppSelector } from "@/lib/hooks";

export function PhotosTest() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const { user } = useAppSelector((s) => s.auth);
  const ownerId = useMemo(() => user?._id || user?.id || "", [user]);
  const moduleId = "MOD_B";

  const camRef = useRef<HTMLInputElement | null>(null);
  const galRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    const list = await listPhotos({ owner: ownerId, module: moduleId });
    setPhotos(list);
    const map: Record<string, string> = {};
    for (const p of list) {
      try {
        map[p._id] = await getPhotoThumbUrl(p._id);
      } catch {}
    }
    setUrls(map);
  }, [moduleId, ownerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onPick = async (f?: File | null) => {
    if (!f) return;
    await savePhoto(f, { owner: ownerId, module: moduleId });
    await refresh();
  };

  const onDelete = async (id: string) => {
    await deletePhoto(id);
    await refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <input
          ref={galRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <Button onClick={() => camRef.current?.click()} disabled={!ownerId}>
          Tomar foto
        </Button>
        <Button variant="secondary" onClick={() => galRef.current?.click()} disabled={!ownerId}>
          Subir desde galeria
        </Button>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((p) => (
          <li key={p._id} className="relative group">
            <img src={urls[p._id]} alt={p._id} className="w-full h-32 object-cover rounded-xl border" />
            <button
              onClick={() => onDelete(p._id)}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

