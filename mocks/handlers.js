// Definición de handlers para interceptar peticiones HTTP en pruebas
import { rest } from "msw";

export const handlers = [
  // Simula una respuesta exitosa para el endpoint de login
  rest.post("/auth/login", (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ success: true }));
  }),
];
