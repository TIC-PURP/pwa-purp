// src/lib/notify.ts
// ==============================================
// Utilidades centralizadas para mostrar toasts
// con la librería Sonner, usando mensajes
// consistentes por tipo y evitando duplicados.
//
// ¿Por qué este wrapper (notify) en vez de usar toast directo?
// - Consistencia visual: mismos colores por tipo de acción
// - Mensajes claros: un solo lugar para ajustar el tono
// - Deduplicación: evita mostrar el mismo mensaje dos veces seguidas
// - Menos código en la UI: llamas notify.success/info/warn/error y listo
// ==============================================
"use client";

import { toast } from "sonner";

// Genera un id estable a partir del tipo y el mensaje.
// Esto permite que Sonner reemplace el toast si se llama
// con el mismo (tipo, mensaje) en muy poco tiempo, reduciendo
// toasts duplicados visualmente.
function key(type: string, msg: string) {
  return `${type}:${msg}`;
}

// Duración por defecto (en milisegundos) para los toasts.
// Suficiente para leer, sin ser molesto.
const DURATION = 2500;
// Clases utilitarias por tipo (Tailwind):
// - info: azul (avisos, estado offline, acciones en cola)
// - warn: ámbar (advertencias, desactivaciones)
const classes = {
  info: "bg-sky-600 text-white",
  warn: "bg-amber-500 text-black",
};

export const notify = {
  /**
   * Éxito (verde): para operaciones completadas correctamente
   * Ej.: crear/editar/activar elementos
   */
  success: (msg: string) =>
    toast.success(msg, { id: key("success", msg), duration: DURATION }),

  /**
   * Información (azul): para avisos no críticos
   * Ej.: “Se sincronizará cuando haya internet”, “Guardado sin conexión”
   */
  info: (msg: string) =>
    toast(msg, {
      id: key("info", msg),
      duration: DURATION,
      className: classes.info,
    }),

  /**
   * Advertencia (ámbar): para desactivaciones o acciones reversibles
   * Ej.: “Usuario desactivado”, “Revisar configuración”
   */
  warn: (msg: string) =>
    toast(msg, {
      id: key("warn", msg),
      duration: DURATION,
      className: classes.warn,
    }),

  /**
   * Error (rojo): para fallos y acciones destructivas
   * Ej.: “No se pudo guardar”, “Usuario eliminado permanentemente”
   */
  error: (msg: string) =>
    toast.error(msg, { id: key("error", msg), duration: DURATION }),
};

export type Notify = typeof notify;
