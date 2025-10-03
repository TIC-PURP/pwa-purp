"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { listFiles, saveFileDoc, getFileUrl, deleteFile, type FileDoc } from "@/lib/database";
import { useAppSelector } from "@/lib/hooks";

/**
 * FileUploader es un componente reutilizable para cargar y listar archivos
 * genéricos. Permite al usuario seleccionar cualquier tipo de archivo
 * desde la galería y guardarlo como attachment usando saveFileDoc. El
 * componente acepta metadatos del propietario por props o, si no se
 * proporcionan, los toma del usuario autenticado. También expone un
 * callback onSaved para notificar al padre cuando finaliza un guardado
 * exitoso.
 */
export interface FileUploaderProps {
  /** Identificador único del propietario. Si falta se usa el usuario actual. */
  ownerId?: string | null;
  /** Nombre del propietario para metadata. */
  ownerName?: string;
  /** Correo electrónico del propietario para metadata. */
  ownerEmail?: string;
  /** Desactiva acciones si está en modo solo lectura. */
  readOnly?: boolean;
  /** Límite de archivos a obtener en listFiles. */
  limit?: number;
  /** Callback que se dispara tras guardar exitosamente. */
  onSaved?: () => void;
}

type PendingFile = {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
};

export function FileUploader({
  ownerId: propOwnerId,
  ownerName: propOwnerName,
  ownerEmail: propOwnerEmail,
  readOnly = false,
  limit = 50,
  onSaved,
}: FileUploaderProps) {
  const user = useAppSelector((s) => s.auth.user);
const ownerId = propOwnerId ?? (user?._id ?? user?.id ?? null);
const ownerName = propOwnerName ?? (((user?.name || "").trim()) || user?.email || undefined);
const ownerEmail = propOwnerEmail ?? (user?.email || undefined);

  const [files, setFiles] = useState<FileDoc[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

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
      revokeUrl(value);
    }
  }, [revokeUrl]);

  // Refresca la lista de archivos
  const refresh = useCallback(async () => {
    if (!ownerId) {
      setFiles([]);
      setUrls((prev) => {
        revokeUrls(prev);
        return {};
      });
      return;
    }
    const list = await listFiles({ owner: ownerId, limit });
    setFiles(list);
    const map: Record<string, string> = {};
    for (const f of list) {
      try {
        map[f._id] = await getFileUrl(f._id);
      } catch {
        // URL fallida, ignorar
      }
    }
    setUrls((prev) => {
      revokeUrls(prev);
      return map;
    });
  }, [ownerId, revokeUrls, limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Al desmontar, revocar URLs
  useEffect(() => {
    return () => {
      revokeUrls(urls);
      pending.forEach((item) => revokeUrl(item.url));
    };
  }, [urls, revokeUrls, pending, revokeUrl]);

  // Reiniciar pendientes cuando cambia owner o readonly
  useEffect(() => {
    if (!ownerId || readOnly) {
      setPending((prev) => {
        if (!prev.length) return prev;
        prev.forEach((item) => revokeUrl(item.url));
        return [];
      });
    }
  }, [ownerId, readOnly, revokeUrl]);

  // Selección de archivo
  const onPick = useCallback((file?: File | null) => {
    if (!file) return;
    if (!ownerId) return;
    if (readOnly || isSaving) return;
    let url = "";
    try {
      if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
        url = URL.createObjectURL(file);
      }
    } catch (error) {
      console.error("Error al crear vista previa del archivo", error);
      setErrorMsg("No se pudo preparar el archivo seleccionado, intenta nuevamente.");
    }
    const id = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const item: PendingFile = { id, file, url, name: file.name, size: file.size };
    setPending((prev) => [...prev, item]);
    setErrorMsg(null);
  }, [ownerId, readOnly, isSaving]);

  // Elimina un pendiente
  const removePending = useCallback((id: string) => {
    if (isSaving) return;
    setPending((prev) => {
      const next: PendingFile[] = [];
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

  // Descarta todos
  const discardPending = useCallback(() => {
    if (isSaving) return;
    setPending((prev) => {
      if (!prev.length) return prev;
      prev.forEach((item) => revokeUrl(item.url));
      return [];
    });
    setErrorMsg(null);
  }, [isSaving, revokeUrl]);

  // Guardar todos los pendientes
  const handleSave = useCallback(async () => {
    if (!ownerId || readOnly || isSaving || pending.length === 0) return;
    setIsSaving(true);
    setErrorMsg(null);
    const queue = pending.slice();
    const savedIds = new Set<string>();
    try {
      for (const item of queue) {
        const result = await saveFileDoc(item.file, {
          owner: ownerId,
          ownerName,
          ownerEmail,
          fileName: item.file.name,
          mimeType: item.file.type,
        });
        if (result?._id) savedIds.add(item.id);
      }
      setPending((prev) => prev.filter((item) => {
        const shouldKeep = !savedIds.has(item.id);
        if (!shouldKeep) revokeUrl(item.url);
        return shouldKeep;
      }));
      await refresh();
      onSaved?.();
    } catch (err) {
      console.error("Error al guardar archivos", err);
      setErrorMsg("No se pudieron guardar todos los archivos. Inténtalo nuevamente.");
      setPending((prev) => prev.filter((item) => {
        const shouldKeep = !savedIds.has(item.id);
        if (!shouldKeep) revokeUrl(item.url);
        return shouldKeep;
      }));
    } finally {
      setIsSaving(false);
    }
  }, [ownerId, readOnly, isSaving, pending, ownerName, ownerEmail, revokeUrl, refresh, onSaved]);

  // Eliminar un archivo guardado
  const onDelete = useCallback(async (id: string) => {
    if (readOnly || isSaving) return;
    await deleteFile(id);
    await refresh();
  }, [readOnly, isSaving, refresh]);

  const hasPending = pending.length > 0;
  const disableSelect = !ownerId || readOnly || isSaving;
  const saveLabel = pending.length === 1 ? "Guardar 1 archivo" : `Guardar ${pending.length} archivos`;
  const disableSave = readOnly || !ownerId || !hasPending || isSaving;
  const disableDiscard = !hasPending || isSaving;

  return (
    <div className="space-y-4">
      {/* Selector de archivos */}
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <Button disabled={disableSelect} onClick={() => fileRef.current?.click()}>
          Seleccionar archivo
        </Button>
        {hasPending && (
          <>
            <Button disabled={disableSave} onClick={() => void handleSave()}>
              {isSaving ? "Guardando..." : saveLabel}
            </Button>
            <Button aria-label="Descartar pendientes" disabled={disableDiscard} onClick={discardPending} variant="outline">
              Descartar
            </Button>
          </>
        )}
      </div>
      {/* Mensajes */}
      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
      {(!ownerId || readOnly) && !hasPending && (
        <p className="text-sm text-muted-foreground">
          {!ownerId ? "Debes iniciar sesión para subir o ver tus archivos." : "Tus permisos actuales son de solo lectura."}
        </p>
      )}
      {/* Pendientes */}
      {hasPending && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Pendientes por guardar ({pending.length})</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pending.map((item) => (
              <li key={item.id} className="relative group border rounded-xl p-2">
                <div className="flex flex-col space-y-1">
                  <p className="truncate font-medium">{item.name || "Archivo pendiente"}</p>
                  <p className="text-xs text-muted-foreground">{(item.size / 1024).toFixed(1)} KB</p>
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
      {/* Archivos guardados */}
      <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {files.map((f) => (
          <li key={f._id} className="relative group border rounded-xl p-2">
            <div className="flex flex-col space-y-1">
              <p className="truncate font-medium">{f.fileName || f._id}</p>
              <p className="text-xs text-muted-foreground">{f.createdAt ? new Date(f.createdAt).toLocaleString() : ""}</p>
              {urls[f._id] && (
                <a
                  href={urls[f._id]}
                  download={f.fileName || undefined}
                  className="text-sm text-blue-600 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Descargar
                </a>
              )}
            </div>
            {!readOnly && (
              <button
                onClick={() => onDelete(f._id)}
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