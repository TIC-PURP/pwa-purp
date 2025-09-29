"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { listPhotos, savePhoto, getPhotoThumbUrl, deletePhoto } from "@/lib/database";
import { useAppSelector } from "@/lib/hooks";

type PhotoDoc = {
  _id: string;
  ownerName?: string;
  ownerEmail?: string;
  createdAt: string;
};

type PhotosTestProps = {
  readOnly?: boolean;
};

export function PhotosTest({ readOnly = false }: PhotosTestProps) {
  const user = useAppSelector((s) => s.auth.user);
  const ownerId = user?._id ?? user?.id ?? null;
  const ownerName = (user?.name || "").trim() || user?.email || undefined;
  const ownerEmail = user?.email || undefined;

  const [photos, setPhotos] = useState<PhotoDoc[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const camRef = useRef<HTMLInputElement | null>(null);
  const galRef = useRef<HTMLInputElement | null>(null);

  const revokeUrls = useCallback((map: Record<string, string>) => {
    if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") {
      return;
    }
    for (const value of Object.values(map)) {
      if (value) URL.revokeObjectURL(value);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!ownerId) {
      setPhotos([]);
      setUrls((prev) => {
        revokeUrls(prev);
        return {};
      });
      return;
    }
    const list = await listPhotos({ owner: ownerId });
    setPhotos(list as PhotoDoc[]);
    const map: Record<string, string> = {};
    for (const p of list) {
      try {
        map[p._id] = await getPhotoThumbUrl(p._id);
      } catch {}
    }
    setUrls((prev) => {
      revokeUrls(prev);
      return map;
    });
  }, [ownerId, revokeUrls]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => () => revokeUrls(urls), [revokeUrls, urls]);

  const onPick = useCallback(async (f?: File | null) => {
    if (!f || !ownerId || readOnly) return;
    await savePhoto(f, {
      owner: ownerId,
      ownerName,
      ownerEmail,
    });
    await refresh();
  }, [ownerEmail, ownerId, ownerName, readOnly, refresh]);

  const onDelete = useCallback(async (id: string) => {
    if (readOnly) return;
    await deletePhoto(id);
    await refresh();
  }, [readOnly, refresh]);

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
        <Button disabled={!ownerId || readOnly} onClick={() => camRef.current?.click()}>Tomar foto</Button>
        <Button
          disabled={!ownerId || readOnly}
          variant="secondary"
          onClick={() => galRef.current?.click()}
        >
          Subir desde galeria
        </Button>
      </div>
      {(!ownerId || readOnly) && (
        <p className="text-sm text-muted-foreground">
          {!ownerId ? "Debes iniciar sesion para capturar o ver tus fotos." : "Tus permisos actuales son de solo lectura."}
        </p>
      )}
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {photos.map((p) => (
          <li key={p._id} className="relative group">
            <img
              src={urls[p._id]}
              alt={p._id}
              className="w-full h-32 object-cover rounded-xl border"
            />
            <div className="absolute inset-x-0 bottom-0 p-2 text-xs bg-black/40 text-white rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="truncate">{p.ownerName || ownerName || ""}</p>
              <p>{p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}</p>
            </div>
            {!readOnly && (
              <button
                onClick={() => onDelete(p._id)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded"
              >
                Eliminar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

