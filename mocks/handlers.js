// Definición de handlers para interceptar peticiones HTTP en pruebas usando
// Mock Service Worker (msw). Cada handler describe cómo debe responder el
// servidor simulado ante una petición concreta.
import { rest } from "msw";

export const handlers = [
  // Simula una respuesta exitosa para el endpoint de login. El primer argumento
  // es la URL interceptada, seguido de un resolver que recibe el request
  // original (`req`), una función para construir la respuesta (`res`) y el
  // contexto con utilidades (`ctx`).
  rest.post("/auth/login", (req, res, ctx) => {
    // Devuelve un estado 200 con un cuerpo JSON indicando éxito.
    return res(ctx.status(200), ctx.json({ success: true }));
  }),
];
