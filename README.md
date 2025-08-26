# Proyecto PWA PURP

Este proyecto es una **Aplicación Web Progresiva (PWA)** desarrollada con **Next.js, React, TypeScript, Redux y PouchDB**, pensada para funcionar en modo **offline-first** y sincronizar con **CouchDB**.  
Incluye soporte para **autenticación, manejo de errores, integración con Sentry, Redux DevTools, service workers y TailwindCSS**.

---

## Estructura del Proyecto

```
pwa-purp/
├── .env.local
├── .env.sentry-build-plugin
├── .gitattributes
├── .gitignore
├── components.json
├── instrumentation.ts
├── instrumentation-client.ts
├── jest.config.ts
├── jest.setup.ts
├── next.config.mjs
├── next-env.d.ts
├── package.json
├── package-lock.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── pouchdb-debug-example.txt
├── pouchdb-logs.md
├── README.md
├── redux-devtools.md
├── redux-devtools-example.txt
├── sentry.client.config.ts
├── sentry.edge.config.ts
├── sentry.server.config.ts
├── tailwind.config.ts
├── tsconfig.json
│
├── mocks/                # Mock Service Worker para pruebas
│   ├── handlers.js
│   └── server.js
│
├── public/               # Archivos públicos (estáticos)
│   ├── manifest.json     # Manifest de la PWA
│   ├── offline.html      # Página offline
│   ├── sw.js             # Service Worker
│   ├── workbox-*.js      # Librerías Workbox
│   └── icons/            # Íconos de la PWA
│
├── scripts/              # Scripts utilitarios
│   └── createDefaultUser.ts
│
├── snippets/             # Ejemplos de uso
│   └── sentry-example-page/
│       └── page.tsx
│
└── src/
    ├── app/              # App Router de Next.js
    │   ├── error.tsx
    │   ├── global-error.tsx
    │   ├── globals.css
    │   ├── head.tsx
    │   ├── layout.tsx
    │   ├── manifest.ts
    │   ├── page.tsx
    │   │
    │   ├── api/          # Endpoints internos
    │   │   ├── auth/login/route.ts
    │   │   ├── couch/[...path]/route.ts
    │   │   └── sentry-example-api/route.ts
    │   │
    │   ├── auth/login/page.tsx
    │   ├── principal/page.tsx
    │   ├── users/page.tsx
    │   └── sentry-example-page/page.tsx
    │
    ├── components/       # Componentes reutilizables
    │   ├── ErrorBoundary.tsx
    │   ├── InstallButton.tsx
    │   ├── providers.tsx
    │   ├── theme-provider.tsx
    │   │
    │   ├── auth/         # Componentes de autenticación
    │   │   ├── login-form.tsx
    │   │   └── route-guard.tsx
    │   │
    │   ├── layout/       # Layout principal
    │   │   └── navbar.tsx
    │   │
    │   └── ui/           # Librería UI personalizada
    │       ├── accordion.tsx
    │       ├── alert-dialog.tsx
    │       ├── alert.tsx
    │       ├── avatar.tsx
    │       ├── badge.tsx
    │       ├── breadcrumb.tsx
    │       ├── button.tsx
    │       ├── calendar.tsx
    │       ├── card.tsx
    │       ├── carousel.tsx
    │       ├── chart.tsx
    │       ├── checkbox.tsx
    │       ├── collapsible.tsx
    │       ├── command.tsx
    │       ├── context-menu.tsx
    │       ├── dialog.tsx
    │       ├── drawer.tsx
    │       ├── dropdown-menu.tsx
    │       ├── form.tsx
    │       ├── hover-card.tsx
    │       ├── input-otp.tsx
    │       └── ... (más componentes)
```

---

## Explicación de Archivos Clave

### Configuración
- **package.json / pnpm-lock.yaml / package-lock.json**: Definición de dependencias del proyecto.
- **tsconfig.json**: Configuración de TypeScript.
- **tailwind.config.ts**: Configuración de TailwindCSS.
- **postcss.config.mjs**: Configuración de PostCSS.
- **next.config.mjs**: Configuración principal de Next.js.
- **.env.local**: Variables de entorno locales (no deben subirse al repo).
- **.env.sentry-build-plugin**: Configuración de Sentry para monitoreo.

### Testing
- **jest.config.ts / jest.setup.ts**: Configuración para pruebas con Jest.
- **mocks/**: Mock Service Worker para simular APIs en pruebas.

### Seguridad y Errores
- **sentry.client.config.ts / sentry.server.config.ts / sentry.edge.config.ts**: Configuración de Sentry para monitoreo en cliente, servidor y edge.
- **ErrorBoundary.tsx**: Componente para capturar errores en React.

### PWA
- **public/manifest.json**: Define nombre, colores e íconos de la app.
- **public/sw.js / workbox-*.js**: Service Worker y librerías Workbox.
- **public/offline.html**: Página mostrada cuando no hay conexión.

### Lógica del Proyecto
- **src/app/**: Sistema de rutas (App Router de Next.js).
  - **api/**: Endpoints de autenticación, conexión con CouchDB y ejemplo de Sentry.
  - **auth/login/page.tsx**: Vista de login.
  - **principal/page.tsx**: Vista principal de la app.
  - **users/page.tsx**: Gestión de usuarios.
- **src/components/**: Librería de componentes.
  - **auth/**: Formulario de login y guardas de ruta.
  - **layout/**: Barra de navegación.
  - **ui/**: Conjunto de componentes UI reutilizables.

---

## Ejecución del Proyecto

1. **Instalar dependencias**
   ```bash
   npm install
   # o
   pnpm install
   ```

2. **Ejecutar en desarrollo**
   ```bash
   npm run dev
   ```

3. **Build de producción**
   ```bash
   npm run build
   npm run start
   ```

---

## Notas Importantes
- La app está preparada para funcionar en **modo offline-first** usando **PouchDB + CouchDB**.
- Se integra con **Sentry** para monitoreo de errores.
- Usa **Redux** y soporta **Redux DevTools** para depuración.
- La UI está construida con **TailwindCSS** y componentes reutilizables.