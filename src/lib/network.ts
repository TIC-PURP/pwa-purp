// src/lib/network.ts
// Utilidades relacionadas con el estado de conectividad del navegador

/**
 * Devuelve true si el navegador reporta estar en línea. En navegadores donde
 * `navigator.onLine` no está disponible o devuelve un valor no booleano,
 * asumimos que hay conexión para permitir reintentos.
 */
export function isNavigatorOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  const value = navigator.onLine;
  return typeof value === "boolean" ? value : true;
}

/**
 * Devuelve true únicamente cuando el navegador reporta explícitamente estar
 * fuera de línea.
 */
export function isNavigatorOffline(): boolean {
  return !isNavigatorOnline();
}
