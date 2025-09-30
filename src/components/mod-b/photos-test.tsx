"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { listPhotos, savePhoto, getPhotoThumbUrl, deletePhoto } from "@/lib/database";
import { useAppSelector } from "@/lib/hooks";

const enablePhotoLogs =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_DEBUG_PHOTOS === "true" ||
      (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_PHOTOS !== "false")
    : false;

function logPhotoUI(label: string, payload?: unknown) {
  if (!enablePhotoLogs) return;
  if (typeof payload === "undefined") {
    console.log(`[photos-ui] ${label}`);
  } else {
    console.log(`[photos-ui] ${label}`, payload);
  }
}

type PhotoDoc = {
  _id: string;
  ownerName?: string;
  ownerEmail?: string;
  createdAt: string;
};

type PhotosTestProps = {
  readOnly?: boolean;
};

type PendingPhoto = {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
};

export function PhotosTest({ readOnly = false }: PhotosTestProps) {
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
    if (typeof URL === "undefined") return;
    if (typeof URL.revokeObjectURL !== "function") return;
    try {
      URL.revokeObjectURL(value);
    } catch {}
  }, []);

  const revokeUrls = useCallback((map: Record<string, string>) => {
    if (!map) return;
    for (const value of Object.values(map)) {
      revokeUrl(value);
    }
  }, [revokeUrl]);

  const refresh = useCallback(async () => {
    logPhotoUI("refrescar:inicio", { ownerId });
    if (!ownerId) {
      setPhotos([]);
      setUrls((prev) => {
        revokeUrls(prev);
        return {};
      });
      logPhotoUI("refrescar:omitir", "sin id de propietario");
      return;
    }
    const list = await listPhotos({ owner: ownerId });
    logPhotoUI("refrescar:lista", { cantidad: list.length });
    setPhotos(list as PhotoDoc[]);
    const map: Record<string, string> = {};
    for (const p of list) {
      try {
        map[p._id] = await getPhotoThumbUrl(p._id);
      } catch (error) {
        logPhotoUI("refrescar:error-miniatura", { id: p._id, error });
      }
    }
    setUrls((prev) => {
      revokeUrls(prev);
      return map;
    });
    logPhotoUI("refrescar:fin", { ownerId });
  }, [ownerId, revokeUrls]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => () => revokeUrls(urls), [revokeUrls, urls]);

  useEffect(() => {
    if (!ownerId || readOnly) {
      setPending((prev) => {
        if (!prev.length) return prev;
        prev.forEach((item) => revokeUrl(item.url));
        return [];
      });
    }
  }, [ownerId, readOnly, revokeUrl]);

  useEffect(() => {
    return () => {
      pending.forEach((item) => revokeUrl(item.url));
    };
  }, [pending, revokeUrl]);

  const onPick = useCallback((file?: File | null) => {
    if (!file) {
      logPhotoUI("seleccionar:omitir", { motivo: "sin archivo" });
      return;
    }
    if (!ownerId) {
      logPhotoUI("seleccionar:omitir", { motivo: "sin propietario" });
      return;
    }
    if (readOnly) {
      logPhotoUI("seleccionar:omitir", { motivo: "solo lectura" });
      return;
    }
    if (isSaving) {
      logPhotoUI("seleccionar:omitir", { motivo: "guardado en progreso" });
      return;
    }
    logPhotoUI("seleccionar:archivo", { nombre: file.name, tamano: file.size, tipo: file.type });
    let url = "";
    try {
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        url = URL.createObjectURL(file);
      }
    } catch (error) {
      console.error("Error al preparar la foto seleccionada", error);
      logPhotoUI("seleccionar:error", error);
      setErrorMsg("No se pudo preparar la foto, intenta nuevamente.");
    }
    const id = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: PendingPhoto = {
      id,
      file,
      url,
      name: file.name,
      size: file.size,
    };
    setPending((prev) => [...prev, item]);
    logPhotoUI("pendientes:agregar", { id: item.id, nombre: item.name, tamano: item.size });
    setErrorMsg(null);
  }, [isSaving, ownerId, readOnly]);

  const removePending = useCallback((id: string) => {
    if (isSaving) return;
    logPhotoUI("pendientes:eliminar", { id });
    setPending((prev) => {
      const next: PendingPhoto[] = [];
      for (const item of prev) {
        if (item.id === id) {
          revokeUrl(item.url);
          continue;
        }
        next.push(item);
      }
      return next;
    });
  }, [isSaving, revokeUrl]);

  const discardPending = useCallback(() => {
    if (isSaving) return;
    setPending((prev) => {
      if (!prev.length) return prev;
      logPhotoUI("pendientes:descartar-todos", { cantidad: prev.length });
      prev.forEach((item) => revokeUrl(item.url));
      return [];
    });
    setErrorMsg(null);
  }, [isSaving, revokeUrl]);

  const handleSave = useCallback(async () => {
    if (!ownerId || readOnly || isSaving || pending.length === 0) return;
    logPhotoUI("guardar:inicio", { pendientes: pending.length });
    setIsSaving(true);
    setErrorMsg(null);
    const queue = pending.slice();
    const savedIds = new Set<string>();

    try {
      for (const item of queue) {
        const result = await savePhoto(item.file, {
          owner: ownerId,
          ownerName,
          ownerEmail,
        });
        savedIds.add(item.id);
        logPhotoUI("guardar:exito", { idPendiente: item.id, idDocumento: result?._id });
      }
      setPending((prev) => prev.filter((item) => {
        const shouldKeep = !savedIds.has(item.id);
        if (!shouldKeep) revokeUrl(item.url);
        return shouldKeep;
      }));
      await refresh();
      logPhotoUI("guardar:refresco-completado", { pendientesRestantes: pending.length - savedIds.size });
    } catch (err) {
      console.error("Error al guardar fotos", err);
      logPhotoUI("guardar:error", err);
      setErrorMsg("No se pudieron guardar todas las fotos. Inténtalo nuevamente.");
      setPending((prev) => prev.filter((item) => {
        const shouldKeep = !savedIds.has(item.id);
        if (!shouldKeep) revokeUrl(item.url);
        return shouldKeep;
      }));
    } finally {
      setIsSaving(false);
      logPhotoUI("guardar:fin");
    }
  }, [isSaving, ownerEmail, ownerId, ownerName, pending, readOnly, refresh, revokeUrl]);

  const onDelete = useCallback(async (id: string) => {
    if (readOnly || isSaving) return;
    logPhotoUI("eliminar:inicio", { id });
    await deletePhoto(id);
    logPhotoUI("eliminar:fin", { id });
    await refresh();
  }, [isSaving, readOnly, refresh]);

  const hasPending = pending.length > 0;
  const disableCapture = !ownerId || readOnly || isSaving;
  const saveLabel = pending.length === 1 ? "Guardar 1 foto" : `Guardar ${pending.length} fotos`;
  const disableSave = readOnly || !ownerId || !hasPending || isSaving;
  const disableDiscard = !hasPending || isSaving;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
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
        <Button disabled={disableCapture} onClick={() => camRef.current?.click()}>Tomar foto</Button>
        <Button
          disabled={disableCapture}
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
              disabled={disableDiscard}
              onClick={discardPending}
              variant="outline"
            >
              Descartar
            </Button>
          </>
        )}
      </div>
      {errorMsg && (
        <p className="text-sm text-destructive">{errorMsg}</p>
      )}
      {(!ownerId || readOnly) && !hasPending && (
        <p className="text-sm text-muted-foreground">
          {!ownerId ? "Debes iniciar sesion para capturar o ver tus fotos." : "Tus permisos actuales son de solo lectura."}
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
                {item.url ? (
                  <img
                    src={item.url}
                    alt={item.name || item.id}
                    className="w-full h-32 object-cover rounded-xl border"
                  />
                ) : (
                  <div className="w-full h-32 flex items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">
                    Vista previa no disponible
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 p-2 text-xs bg-black/40 text-white rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="truncate">{item.name || "Foto pendiente"}</p>
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
