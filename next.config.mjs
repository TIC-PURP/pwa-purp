// Configuración de Next.js incluyendo cabeceras de seguridad y cacheo
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Activa comprobaciones adicionales de React en desarrollo
  reactStrictMode: true,
  // Deshabilita la optimización de imágenes de Next (útil en entornos limitados)
  images: { unoptimized: true },
  async headers() {
    // Política de seguridad de contenido para limitar recursos externos
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "font-src 'self' data:",
      "frame-ancestors 'self'"
    ].join('; ');

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" }
    ];

    return [
      {
        // Cabeceras aplicadas a todas las rutas
        source: "/:path*",
        headers: securityHeaders
      },
      {
        // Evitamos almacenar en caché respuestas de las APIs sensibles
        source: "/api/couch/:path*",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }]
      },
      {
        source: "/api/auth/:path*",
        headers: [...securityHeaders, { key: "Cache-Control", value: "no-store" }]
      }
    ];
  }
};

export default nextConfig;
