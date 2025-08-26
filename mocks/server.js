// Servidor de mocks para pruebas, usando los handlers definidos
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
