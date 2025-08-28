// Configura un servidor de mocks para las pruebas en Node utilizando msw.
// `setupServer` crea un servidor que intercepta peticiones HTTP de forma
// similar a como lo haría el navegador, permitiendo definir respuestas
// controladas para los tests.
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Exporta una instancia del servidor con todos los handlers registrados para
// que los tests puedan iniciarlo y detenerlo según sea necesario.
export const server = setupServer(...handlers);
