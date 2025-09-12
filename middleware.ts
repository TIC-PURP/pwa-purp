import { NextResponse, type NextRequest } from "next/server";

function generateNonce() {
  // 16 bytes aleatorios en base64
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  // Convertir a base64 URL-safe
  const bin = String.fromCharCode(...arr);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function middleware(req: NextRequest) {
  const nonce = generateNonce();

  // Propagar el nonce hacia el árbol de React (app/...) mediante cabecera
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const isDev = process.env.NODE_ENV !== "production";
  const connectSrc = [
    "'self'",
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
  ];

  const scriptSrc: string[] = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `connect-src ${connectSrc.join(' ')}`,
    "font-src 'self' data:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    // Aplicar a todo menos assets estáticos
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|workbox-.*|.*\\.(png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};

