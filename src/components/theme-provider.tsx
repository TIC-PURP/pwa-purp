// Proveedor de temas usando la librería next-themes
"use client";

import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Envuelve la aplicación para manejar el modo oscuro/claro
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
