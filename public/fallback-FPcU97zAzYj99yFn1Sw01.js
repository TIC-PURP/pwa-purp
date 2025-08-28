// Script de reserva utilizado por Workbox cuando una petición de navegación
// falla. Si el destino de la petición es un documento HTML y no puede
// recuperarse de la red, el service worker responde con la página
// `offline.html` almacenada en caché. Para cualquier otro tipo de recurso se
// devuelve un error genérico de `Response`.
(() => {
  "use strict";
  self.fallback = async (e) =>
    "document" === e.destination
      ? caches.match("/offline.html", { ignoreSearch: !0 })
      : Response.error();
})();
