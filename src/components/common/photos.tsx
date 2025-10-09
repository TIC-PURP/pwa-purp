"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { listPhotos, savePhoto, getPhotoThumbUrl, deletePhoto } from "@/lib/database";
import { useAppSelector } from "@/lib/hooks";
import { notify } from "@/lib/notify";

type PhotoDoc = {
  _id: string;
  ownerName?: string;
  ownerEmail?: string;
  createdAt: string;
};

type PendingPhoto = {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
};

export function PhotosTest() {
  const user = useAppSelector((s) => s.auth.user);
  const ownerId = user?._id ?? user?.id ?? null;
  const ownerName = (user?.name || "").trim() || user?.email || undefined;
  const ownerEmail = user?.email || undefined;

  const [photos, setPhotos] = useState<PhotoDoc[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const camRef = useRef<HTMLInputElement | null>(null);
  const galRef = useRef<HTMLInputElement | null>(null);

  const revokeUrl = useCallback((value: string) => {
    if (!value) return;
    if (typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") return;
    try {
      URL.revokeObjectURL(value);
    } catch {}
  }, []);

  const revokeUrls = useCallback((map: Record<string, string>) => {
    if (!map) return;
    for (const value of Object.values(map)) {
      if (value) revokeUrl(value);
    }
  }, [revokeUrl]);

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
        const thumb = await getPhotoThumbUrl(p._id);
        if (thumb) {
          map[p._id] = thumb;
        }
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

  useEffect(() => {
    return () => {
      revokeUrls(urls);
      pending.forEach((item) => revokeUrl(item.url));
    };
  }, [revokeUrls, urls, pending, revokeUrl]);

  useEffect(() => {
    if (!ownerId) {
      setPending((prev) => {
        if (!prev.length) return prev;
        prev.forEach((item) => revokeUrl(item.url));
        return [];
      });
    }
  }, [ownerId, revokeUrl]);

  const onPick = useCallback((file?: File | null) => {
    if (!file || !ownerId || isSaving) return;
    let url = "";
    try {
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        url = URL.createObjectURL(file);
      }
    } catch (error) {
      console.error("Error al generar vista previa de la foto", error);
      setErrorMsg("No se pudo preparar la foto seleccionada, intenta nuevamente.");
      return;
    }
    const id = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: PendingPhoto = {
      id,
      file,
      url,
      name: file.name || "Foto",
      size: typeof file.size === "number" ? file.size : 0,
    };
    setPending((prev) => [...prev, item]);
    setErrorMsg(null);
  }, [ownerId, isSaving]);

  const removePending = useCallback((id: string) => {
    setPending((prev) => {
      const next = prev.filter((item) => {
        const shouldKeep = item.id !== id;
        if (!shouldKeep) revokeUrl(item.url);
        return shouldKeep;
      });
      return next;
    });
  }, [revokeUrl]);

  const discardPending = useCallback(() => {
    setPending((prev) => {
      if (!prev.length) return prev;
      prev.forEach((item) => revokeUrl(item.url));
      return [];
    });
    setErrorMsg(null);
  }, [revokeUrl]);

  const handleSave = useCallback(async () => {
    if (!ownerId || !pending.length) return;
    setIsSaving(true);
    setErrorMsg(null);
    const queue = [...pending];
    const saved = new Set<string>();
    for (const item of queue) {
      try {
        const result = await savePhoto(item.file, {
          owner: ownerId,
          ownerName,
          ownerEmail,
        });
        saved.add(item.id);
        if (result.path === "remote") {
          notify.success("Foto guardada en la nube.");
        } else if (result.path === "remote-admin") {
          notify.success("Foto guardada en la nube (vía canal seguro).");
        } else if (result.wasOffline) {
          notify.info("Foto guardada sin conexión. Se sincronizará automáticamente al volver el internet.");
        } else {
          notify.warn("Foto guardada localmente. Reintentaremos subirla a la nube en segundo plano.");
        }
        if (result.remoteError && !result.wasOffline) {
          console.warn("savePhoto remote warning:", result.remoteError);
        }
      } catch (error) {
        console.error("Error al guardar foto", error);
        setErrorMsg("No se pudieron guardar todas las fotos. Intenta nuevamente.");
        notify.error("No se pudo guardar la foto en el dispositivo.");
      }
    }
    setPending((prev) => {
      if (!saved.size) return prev;
      return prev.filter((item) => {
        const shouldKeep = !saved.has(item.id);
        if (!shouldKeep) revokeUrl(item.url);
        return shouldKeep;
      });
    });
    try {
      await refresh();
    } finally {
      setIsSaving(false);
    }
  }, [ownerId, pending, ownerName, ownerEmail, refresh, revokeUrl]);

  const onDelete = useCallback(async (id: string) => {
    try {
      const result = await deletePhoto(id);
      if (result.path === "remote") {
        notify.success("Foto eliminada de la nube.");
      } else if (result.path === "remote-admin") {
        notify.success("Foto eliminada de la nube (vía canal seguro).");
      } else if (result.wasOffline) {
        notify.info("Foto eliminada sin conexión. Se sincronizará el borrado cuando vuelva el internet.");
      } else {
        notify.warn("Foto eliminada localmente. Reintentaremos borrar en la nube.");
      }
      if (result.remoteError && !result.wasOffline) {
        console.warn("deletePhoto remote warning:", result.remoteError);
      }
      await refresh();
    } catch (error) {
      console.error("Error al eliminar foto", error);
      notify.error("No se pudo eliminar la foto.");
    }
  }, [refresh]);

  const hasPending = pending.length > 0;
  const disableSelect = !ownerId || isSaving;
  const disableSave = !ownerId || !hasPending || isSaving;
  const disableDiscard = !hasPending || isSaving;
  const saveLabel = pending.length === 1 ? "Guardar 1 foto" : `Guardar ${pending.length} fotos`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          ref={camRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null);
            if (camRef.current) camRef.current.value = "";
          }}
        />
        <input
          ref={galRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onPick(e.target.files?.[0] ?? null);
            if (galRef.current) galRef.current.value = "";
          }}
        />
        <Button disabled={disableSelect} onClick={() => camRef.current?.click()}>
          Tomar foto
        </Button>
        <Button
          disabled={disableSelect}
          variant="secondary"
          onClick={() => galRef.current?.click()}
        >
          Subir desde galeria
        </Button>
        {hasPending && (
          <>
            <Button disabled={disableSave} onClick={() => void handleSave()}>
              {isSaving ? "Guardando..." : saveLabel}
            </Button>
            <Button
              aria-label="Descartar pendientes"
              disabled={disableDiscard}
              onClick={discardPending}
              variant="outline"
            >
              Descartar
            </Button>
          </>
        )}
      </div>
      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
      {!ownerId && !hasPending && (
        <p className="text-sm text-muted-foreground">
          Debes iniciar sesion para capturar o ver tus fotos.
        </p>
      )}
      {hasPending && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Pendientes por guardar ({pending.length})
          </p>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pending.map((item) => (
              <li key={item.id} className="relative group">
                <img
                  src={item.url}
                  alt={item.name}
                  className="w-full h-32 object-cover rounded-xl border"
                />
                <div className="absolute inset-x-0 bottom-0 p-2 text-xs bg-black/40 text-white rounded-b-xl">
                  <p className="truncate">{item.name || "Foto"}</p>
                  <p>{item.size ? `${(item.size / 1024).toFixed(1)} KB` : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removePending(item.id)}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-muted text-foreground px-2 py-1 rounded"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        </div>
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

