// Configuración de Next.js incluyendo cabeceras de seguridad y cacheo
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Activa comprobaciones adicionales de React en desarrollo
  reactStrictMode: true,
  // Deshabilita la optimización de imágenes de Next (útil en entornos limitados)
  images: { unoptimized: true },
  async headers() {
    // Política de seguridad de contenido para limitar recursos externos
    // Ampliamos connect-src para permitir envíos a Sentry desde el cliente si se usa Sentry.
    const connectSrc = ["'self'"];
    if (process.env.SENTRY_DSN) {
      connectSrc.push("https://*.sentry.io", "https://*.ingest.sentry.io");
    }

    // Generamos la directiva script-src sin permitir unsafe-inline/unsafe-eval
    // Se añade un nonce estático o configurable mediante CSP_SCRIPT_NONCE
    const scriptNonce = process.env.CSP_SCRIPT_NONCE || "staticNonce";
    const scriptSrc = ["'self'", `'nonce-${scriptNonce}'`];

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc.join(' ')}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      `connect-src ${connectSrc.join(' ')}`,
      "font-src 'self' data:",
      "frame-ancestors 'self'",
    ].join('; ');

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ];

    return [
      {
        // Cabeceras aplicadas a todas las rutas
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Evitar cachear el Service Worker para recibir updates inmediatos
        source: "/sw.js",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }],
      },
      {
        // Evitamos almacenar en caché respuestas de las APIs sensibles
        source: "/api/couch/:path*",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/api/auth/:path*",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
