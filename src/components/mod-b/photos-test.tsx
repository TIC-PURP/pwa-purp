"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { listPhotos, savePhoto, getPhotoThumbUrl, deletePhoto } from "@/lib/database";

export function PhotosTest() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Array<{ id: string; url: string }>>([]);

  const camRef = useRef<HTMLInputElement | null>(null);
  const galRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    const list = await listPhotos({});
    setPhotos(list);
    const entries = await Promise.all(
      list.map(async (p) => {
        try {
          const url = await getPhotoThumbUrl(p._id);
          return [p._id, url] as const;
        } catch {
          return null;
        }
      }),
    );
    setUrls((prev) => {
      const next: Record<string, string> = {};
      const keep = new Set(list.map((p) => p._id));
      for (const [id, url] of Object.entries(prev)) {
        if (keep.has(id)) {
          next[id] = url;
        } else if (url && url.startsWith("blob:")) {
          try { URL.revokeObjectURL(url); } catch {}
        }
      }
      for (const entry of entries) {
        if (!entry) continue;
        const [id, url] = entry;
        const previous = next[id];
        if (previous && previous !== url && previous.startsWith("blob:")) {
          try { URL.revokeObjectURL(previous); } catch {}
        }
        next[id] = url;
      }
      return next;
    });
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onPick = async (f?: File | null) => {
    if (!f) return;
    const tempId = `pending:${Date.now()}`;
    let tempUrl: string | null = null;
    try {
      tempUrl = URL.createObjectURL(f);
      setPending((prev) => [{ id: tempId, url: tempUrl! }, ...prev]);
    } catch {}
    try {
      await savePhoto(f, {});
      await refresh();
    } catch (error) {
      console.error("[PhotosTest] savePhoto failed", error);
    } finally {
      setPending((prev) => prev.filter((item) => item.id !== tempId));
      if (tempUrl && tempUrl.startsWith("blob:")) {
        try { URL.revokeObjectURL(tempUrl); } catch {}
      }
    }
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
        <Button onClick={() => camRef.current?.click()}>Tomar foto</Button>
        <Button variant="secondary" onClick={() => galRef.current?.click()}>Subir desde galeria</Button>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {pending.map((p) => (
          <li key={p.id} className="relative">
            <img src={p.url} alt={p.id} className="w-full h-32 object-cover rounded-xl border opacity-90" />
            <div className="absolute inset-0 rounded-xl bg-black/50 text-white text-xs font-semibold flex items-center justify-center">
              Guardando...
            </div>
          </li>
        ))}
        {photos.map((p) => (
          <li key={p._id} className="relative group">
            <img src={urls[p._id] || ""} alt={p._id} className="w-full h-32 object-cover rounded-xl border" />
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

