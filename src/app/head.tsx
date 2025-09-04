// Elementos que se agregan al `<head>` de todas las páginas
export default function Head() {
  // Enlaza el manifest para habilitar capacidades PWA
  return (
    <>
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="theme-color" content="#ffffff" />
      <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
    </>
  );
}
