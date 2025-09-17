// Archivo de inicializacion para Jest.
// Aqui se cargan extensiones y configuraciones que deben estar
// disponibles antes de ejecutar cualquier prueba.
// Importacion necesaria para contar con los matchers extra de Testing Library.
import "@testing-library/jest-dom";

// Silenciar warnings de consola durante las pruebas para mantener la salida limpia.
// Politica:
// - console.warn: solo silencia los mensajes conocidos y ruidosos de la app
//                 (fallback a local en base de datos). Deja pasar el resto.
// - console.error: filtra el warning de React de "not wrapped in act(" y deja pasar otros errores.
const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

beforeAll(() => {
  // Silencia unicamente warns especificos del flujo offline-first
  console.warn = (...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    const isDbFallbackWarn = /remote put failed, falling back to local/i.test(text)
      || /\[createUser\] .*falling back to local/i.test(text)
      || /\[updateUser\] .*falling back to local/i.test(text)
      || /\[database\] remote put failed/i.test(text)
      || /\[database\] admin save failed/i.test(text)
      || /\[database\] admin save error/i.test(text);
    if (isDbFallbackWarn) return;
    originalWarn(...(args as any[]));
  };

  // Filtra mensajes de warning que React emite via console.error
  console.error = (...args: unknown[]) => {
    const text = args.map((a) => String(a)).join(" ");
    const isActWarning = /Warning: .*not wrapped in act\(/.test(text);
    if (isActWarning) return;
    originalError(...(args as any[]));
  };
});

afterAll(() => {
  // Restaura comportamiento original por si otros runners comparten el proceso
  console.warn = originalWarn;
  console.error = originalError;
});
