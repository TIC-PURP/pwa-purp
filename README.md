# Proyecto PWA PURP

Este proyecto es una Aplicación Web Progresiva (PWA) desarrollada con Next.js, React, TypeScript, Redux y PouchDB, pensada para funcionar en modo offline‑first y sincronizar con CouchDB. Incluye soporte para autenticación, manejo de errores, integración con Sentry, service worker y TailwindCSS.

---

## Estructura del Proyecto

```
pwa-purp/
├─ .env.local
├─ .env.sentry-build-plugin
├─ .gitignore
├─ components.json
├─ instrumentation.ts
├─ instrumentation-client.ts
├─ jest.config.ts
├─ jest.setup.ts
├─ next.config.mjs
├─ next-env.d.ts
├─ package.json
├─ package-lock.json
├─ pnpm-lock.yaml
├─ postcss.config.mjs
├─ README.md
├─ sentry.client.config.ts
├─ sentry.edge.config.ts
├─ sentry.server.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
├─ mocks/                # Mock Service Worker para pruebas
│  ├─ handlers.js
│  └─ server.js
├─ public/               # Archivos públicos (estáticos)
│  ├─ manifest.json      # Manifest de la PWA
│  ├─ offline.html       # Página offline
│  ├─ sw.js              # Service Worker
│  └─ icons/             # Íconos de la PWA
├─ docs/local/           # Notas locales y ejemplos (ignorado por git)
│  ├─ redux-devtools.md
│  ├─ pouchdb-logs.md
│  └─ pouchdb-debug-example.txt
└─ src/
   ├─ app/               # App Router de Next.js
   │  ├─ error.tsx
   │  ├─ global-error.tsx
   │  ├─ globals.css
   │  ├─ head.tsx
   │  ├─ layout.tsx
   │  ├─ manifest.ts
   │  ├─ page.tsx
   │  └─ api/            # Endpoints internos
   │     ├─ auth/login/route.ts
   │     ├─ couch/[...path]/route.ts
   │     └─ sentry-example-api/route.ts
   └─ components/        # Componentes reutilizables
      ├─ ErrorBoundary.tsx
      ├─ InstallButton.tsx
      ├─ providers.tsx
      ├─ theme-provider.tsx
      ├─ auth/           # Componentes de autenticación
      │  ├─ login-form.tsx
      │  └─ route-guard.tsx
      └─ ui/             # Librería UI personalizada
         ├─ button.tsx
         ├─ card.tsx
         └─ ...
```

---

## Archivos Clave

### Configuración
- package.json / pnpm-lock.yaml / package-lock.json: Dependencias del proyecto.
- tsconfig.json: Configuración de TypeScript.
- tailwind.config.ts: Configuración de TailwindCSS.
- postcss.config.mjs: Configuración de PostCSS.
- next.config.mjs: Configuración principal de Next.js.
- .env.local: Variables de entorno locales (no subir al repo).
- .env.sentry-build-plugin: Configuración de Sentry para build.

### Testing
- jest.config.ts / jest.setup.ts: Configuración de pruebas con Jest.
- mocks/: MSW (Mock Service Worker) para simular APIs en pruebas.

### PWA
- public/manifest.json: Define nombre, colores e íconos de la app.
- public/sw.js: Service Worker.
- public/offline.html: Página mostrada cuando no hay conexión.

### Lógica del Proyecto
- src/app/: Sistema de rutas (App Router de Next.js).
  - api/: Endpoints de autenticación, conexión con CouchDB y ejemplo de Sentry.
  - auth/login/page.tsx: Vista de login.
  - principal/page.tsx: Vista principal de la app.
  - users/page.tsx: Gestión de usuarios.
- src/components/: Librería de componentes.
  - auth/: Formulario de login y guardas de ruta.
  - layout/: Barra de navegación.
  - ui/: Conjunto de componentes UI reutilizables.

---

## Comandos

1. Instalar dependencias
   ```bash
   npm install
   # o
   pnpm install
   ```

2. Desarrollo
   ```bash
   npm run dev
   ```

3. Producción
   ```bash
   npm run build
   npm run start
   ```

---

## Notas
- La app funciona en modo offline‑first usando PouchDB + CouchDB.
- Se integra con Sentry para monitoreo de errores.
- Usa Redux y soporta Redux DevTools para depuración.
- UI construida con TailwindCSS y componentes reutilizables.

