import type { MetadataRoute } from "next";

// Define el archivo manifest.json para la PWA
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PWA", // Nombre completo
    short_name: "PWA", // Nombre corto
    description: "PWA",
    start_url: "/", // Punto de inicio al abrir la app instalada
    display: "standalone", // Se comporta como aplicación nativa
    background_color: "#0f172a",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    categories: ["business", "productivity"],
    orientation: "portrait-primary",
  };
}
