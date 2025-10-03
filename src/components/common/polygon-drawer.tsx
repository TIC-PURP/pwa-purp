"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import {
  savePolygonDoc,
  listPolygons,
  getPolygonPreviewUrl,
  deletePolygon,
  updatePolygonDoc,
  type PolygonDoc,
} from "@/lib/database";
import { useAppSelector } from "@/lib/hooks";

/**
 * Un punto en formato latitud/longitud obtenido del mapa.
 */
declare global {
  interface Window {
    google?: any;
  }
}
export type LatLng = { lat: number; lng: number };

export interface PolygonDrawerProps {
  /** Identificador del propietario. Usa el usuario autenticado por defecto. */
  ownerId?: string | null;
  /** Nombre del propietario para metadata. */
  ownerName?: string;
  /** Correo del propietario para metadata. */
  ownerEmail?: string;
  /** Desactivar todas las interacciones (modo solo lectura). */
  readOnly?: boolean;
  /** Callback opcional invocado tras guardar satisfactoriamente. */
  onSaved?: () => void;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_SCRIPT_ID = "google-maps-sdk";
const DEFAULT_CENTER = { lat: 20.6736, lng: -103.344 }; // Guadalajara MX

export function PolygonDrawer({
  ownerId: propOwnerId,
  ownerName: propOwnerName,
  ownerEmail: propOwnerEmail,
  readOnly = false,
  onSaved,
}: PolygonDrawerProps) {
  const user = useAppSelector((s) => s.auth.user);
  const ownerId = propOwnerId ?? (user?._id ?? user?.id ?? null);
  const ownerName = useMemo(
    () => propOwnerName ?? (user?.name?.trim() || user?.email || undefined),
    [propOwnerName, user?.name, user?.email],
  );
  const ownerEmail = propOwnerEmail ?? (user?.email || undefined);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const clickListenerRef = useRef<any>(null);
  const mapCenteredRef = useRef(false);

  const [mapsApi, setMapsApi] = useState<any | null>(() =>
    typeof window !== "undefined" && window.google?.maps ? window.google.maps : null,
  );
  const [points, setPoints] = useState<LatLng[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(
    GOOGLE_MAPS_API_KEY ? null : "Falta la variable NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  );
  const [savedPolygons, setSavedPolygons] = useState<PolygonDoc[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const refreshSaved = useCallback(async () => {
    if (!ownerId) {
      setSavedPolygons([]);
      setPreviewUrls((prev) => {
        for (const v of Object.values(prev)) {
          if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
            try {
              URL.revokeObjectURL(v);
            } catch {}
          }
        }
        return {};
      });
      return;
    }
    const list = await listPolygons({ owner: ownerId, limit: 100 });
    setSavedPolygons(list);
    const map: Record<string, string> = {};
    for (const p of list) {
      try {
        const url = await getPolygonPreviewUrl(p._id);
        if (url) map[p._id] = url;
      } catch {}
    }
    setPreviewUrls((prev) => {
      for (const value of Object.values(prev)) {
        if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          try {
            URL.revokeObjectURL(value);
          } catch {}
        }
      }
      return map;
    });
  }, [ownerId]);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  useEffect(() => {
    if (!ownerId) {
      setEditingId(null);
      setPoints([]);
    }
  }, [ownerId]);

  useEffect(() => {
    if (readOnly) {
      setEditingId(null);
    }
  }, [readOnly]);

  useEffect(() => {
    if (!mapsApi && typeof window !== "undefined" && window.google?.maps) {
      setMapError(null);
      setMapsApi(window.google.maps);
    }
  }, [mapsApi]);

  useEffect(() => {
    const maps = mapsApi;
    if (!maps || !containerRef.current || mapInstanceRef.current) return;

    try {
      const map = new maps.Map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 5,
        mapTypeId: "hybrid",
        disableDefaultUI: true,
        gestureHandling: "greedy",
      });
      mapInstanceRef.current = map;
      setMapError(null);
    } catch (error) {
      console.error("Error al inicializar Google Maps", error);
      setMapError("No se pudo cargar Google Maps. Consulta la consola para más detalles.");
    }
  }, [mapsApi]);

  useEffect(() => {
    return () => {
      const maps = window.google?.maps;
      if (clickListenerRef.current && maps?.event?.removeListener) {
        maps.event.removeListener(clickListenerRef.current);
      }
      clickListenerRef.current = null;

      markersRef.current.forEach((marker) => {
        try {
          marker.setMap(null);
        } catch {}
      });
      markersRef.current = [];

      if (polygonRef.current) {
        try {
          polygonRef.current.setMap(null);
        } catch {}
      }
      polygonRef.current = null;
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const maps = mapsApi;
    const map = mapInstanceRef.current;
    if (!maps || !map || readOnly || !ownerId) return;

    if (clickListenerRef.current && maps.event?.removeListener) {
      maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }

    clickListenerRef.current = map.addListener("click", (event: any) => {
      if (readOnly || !ownerId || isSaving) return;
      const lat = event?.latLng?.lat?.();
      const lng = event?.latLng?.lng?.();
      if (typeof lat === "number" && typeof lng === "number") {
        setPoints((prev) => [...prev, { lat, lng }]);
      }
    });

    return () => {
      if (clickListenerRef.current && maps.event?.removeListener) {
        maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
    };
  }, [mapsApi, ownerId, readOnly, isSaving]);

  useEffect(() => {
    const maps = mapsApi;
    const map = mapInstanceRef.current;
    if (!maps || !map) return;

    if (!mapCenteredRef.current) {
      mapCenteredRef.current = true;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            map.setZoom(13);
          },
          () => {
            map.setCenter(DEFAULT_CENTER);
            map.setZoom(5);
          },
          { maximumAge: 60000, timeout: 8000 },
        );
      } else {
        map.setCenter(DEFAULT_CENTER);
        map.setZoom(5);
      }
    }
  }, [mapsApi]);

  useEffect(() => {
    const maps = mapsApi;
    const map = mapInstanceRef.current;
    if (!maps || !map) return;

    markersRef.current.forEach((marker) => {
      try {
        marker.setMap(null);
      } catch {}
    });
    markersRef.current = [];

    points.forEach((pt, index) => {
      const marker = new maps.Marker({
        position: pt,
        map,
        label: String(index + 1),
      });
      marker.addListener("click", () => {
        if (readOnly || isSaving) return;
        setPoints((prev) => prev.filter((_, i) => i !== index));
      });
      markersRef.current.push(marker);
    });

    if (!polygonRef.current) {
      polygonRef.current = new maps.Polygon({
        paths: points,
        map: points.length > 1 ? map : null,
        strokeColor: "#2563eb",
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: "#60a5fa",
        fillOpacity: points.length >= 3 ? 0.35 : 0,
      });
    } else {
      polygonRef.current.setPath(points);
      polygonRef.current.setMap(points.length > 1 ? map : null);
      polygonRef.current.setOptions({ fillOpacity: points.length >= 3 ? 0.35 : 0 });
    }

    if (points.length > 0) {
      const bounds = new maps.LatLngBounds();
      points.forEach((pt) => bounds.extend(pt));
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, 32);
      }
    }
  }, [points, mapsApi, readOnly, isSaving]);

  const removePoint = useCallback((index: number) => {
    if (readOnly || isSaving) return;
    setPoints((prev) => prev.filter((_, i) => i !== index));
  }, [readOnly, isSaving]);

  const clearPoints = useCallback(() => {
    if (readOnly || isSaving) return;
    setPoints([]);
  }, [readOnly, isSaving]);

  const cancelEditing = useCallback(() => {
    if (isSaving) return;
    setEditingId(null);
    setPoints([]);
    setErrorMsg(null);
  }, [isSaving]);

  const savePolygon = useCallback(async () => {
    if (!ownerId || readOnly || isSaving || points.length < 3) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      if (editingId) {
        await updatePolygonDoc(editingId, points, { owner: ownerId, ownerName, ownerEmail });
      } else {
        const result = await savePolygonDoc(points, { owner: ownerId, ownerName, ownerEmail });
        if (!result?._id) {
          throw new Error('polygon save failed');
        }
      }
      await refreshSaved();
      setPoints([]);
      setEditingId(null);
      onSaved?.();
    } catch (error) {
      console.error(editingId ? 'Error al actualizar polígono' : 'Error al guardar polígono', error);
      setErrorMsg(editingId ? 'No se pudo actualizar el polígono. Inténtalo nuevamente.' : 'No se pudo guardar el polígono. Inténtalo nuevamente.');
    } finally {
      setIsSaving(false);
    }
  }, [ownerId, readOnly, isSaving, points, ownerName, ownerEmail, onSaved, refreshSaved, editingId, updatePolygonDoc]);

  const handleDeletePolygon = useCallback(async (id: string) => {
    if (readOnly) return;
    await deletePolygon(id);
    if (editingId === id) {
      setEditingId(null);
      setPoints([]);
    }
    await refreshSaved();
  }, [readOnly, refreshSaved, editingId]);

  const handleEditPolygon = useCallback((doc: PolygonDoc) => {
    if (readOnly || isSaving) return;
    const normalized = Array.isArray(doc.points)
      ? doc.points.map((pt) => ({ lat: Number(pt.lat), lng: Number(pt.lng) }))
      : [];
    setPoints(normalized);
    setEditingId(doc._id);
    setErrorMsg(null);
  }, [readOnly, isSaving]);

  const isEditingActive = Boolean(editingId);
  const primaryButtonLabel = isSaving
    ? (isEditingActive ? "Actualizando..." : "Guardando...")
    : (isEditingActive ? "Actualizar polígono" : "Guardar polígono");
  const disablePrimary = readOnly || isSaving || points.length < 3 || !ownerId;
  const disableClear = readOnly || isSaving || points.length === 0;
  return (
    <div className="space-y-6">
      {GOOGLE_MAPS_API_KEY && (
        <Script
          id={GOOGLE_MAPS_SCRIPT_ID}
          src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`}
          strategy="afterInteractive"
          onLoad={() => {
            if (window.google?.maps) {
              setMapError(null);
              setMapsApi(window.google.maps);
            } else {
              setMapError("Google Maps cargó sin exponer la API. Verifica la consola.");
            }
          }}
          onError={() => {
            setMapError("No se pudo cargar Google Maps. Revisa la API key y la red.");
          }}
        />
      )}

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg border"
        style={{ height: "400px" }}
      >
        {(!mapsApi || !!mapError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-sm text-muted-foreground">
            {mapError ?? "Cargando mapa..."}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={disablePrimary} onClick={() => void savePolygon()}>
          {primaryButtonLabel}
        </Button>
        <Button disabled={disableClear} onClick={clearPoints} variant="secondary">
          Limpiar
        </Button>
        {isEditingActive && (
          <Button disabled={isSaving} onClick={cancelEditing} variant="outline">
            Cancelar edición
          </Button>
        )}
        {points.length > 0 && (
          <span className="self-center text-sm text-muted-foreground">Puntos: {points.length}</span>
        )}
      </div>

      {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
      {!ownerId && <p className="text-sm text-muted-foreground">Debes iniciar sesión para crear polígonos.</p>}
      {readOnly && <p className="text-sm text-muted-foreground">Modo solo lectura activo.</p>}

      {points.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Coordenadas actuales</h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {points.map((pt, index) => (
              <li key={`${pt.lat}-${pt.lng}-${index}`} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                <span>
                  #{index + 1} · lat {pt.lat.toFixed(6)}, lng {pt.lng.toFixed(6)}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removePoint(index)}
                    className="text-xs text-destructive underline"
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {savedPolygons.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Polígonos guardados</h3>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {savedPolygons.map((p) => {
              const isEditing = editingId === p._id;
              return (
                <li
                  key={p._id}
                  className={`relative group overflow-hidden rounded-xl border ${isEditing ? "ring-2 ring-primary" : ""}`}
                >
                  {!readOnly && (
                    <div className="absolute inset-x-2 top-2 z-10 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditPolygon(p)}
                        disabled={isSaving || isEditing}
                        className={`rounded px-2 py-1 text-xs font-medium transition ${isEditing ? "bg-primary text-primary-foreground shadow" : "bg-muted text-foreground hover:bg-muted/80"}`}
                      >
                        {isEditing ? "Editando" : "Editar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePolygon(p._id)}
                        disabled={isSaving}
                        className="rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground shadow transition hover:bg-destructive/90 disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                  {previewUrls[p._id] ? (
                    <img src={previewUrls[p._id]} alt={p._id} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-muted text-muted-foreground">
                      Sin vista previa
                    </div>
                  )}
                  <div className="space-y-1 p-2">
                    <p className="truncate font-medium">{p._id}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
