// Configuración principal de Jest para los tests del proyecto
export default {
  // Entorno que emula un navegador para pruebas de componentes
  testEnvironment: "jsdom",
  // Archivo que se ejecuta antes de cada prueba para configurar utilidades
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Atajos de importación usando el prefijo @
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Transformación de TypeScript a JavaScript con ts-jest
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
  },
  // Ignorar rutas que no contienen pruebas
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};
