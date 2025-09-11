// Elementos que se agregan al `<head>` de todas las páginas
export default function Head() {
  // Enlaza el manifest para habilitar capacidades PWA
  return (
    <>
      <link rel="manifest" href="/manifest.webmanifest" />
      {/* Dynamic theme-color for better PWA UI on mobile */}
      <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
      <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
    </>
  );
}
