// Elementos que se agregan al `<head>` de todas las páginas
export default function Head() {
  // Enlaza el manifest para habilitar capacidades PWA
  return (
    <>
      <link rel="manifest" href="/manifest.json" />
    </>
  );
}
