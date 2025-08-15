# Activar logs de PouchDB

1. Añade esto antes de usar cualquier funcionalidad de PouchDB:

```ts
if (typeof window !== "undefined") {
  localStorage.debug = "pouchdb:*";
}
```

2. Reinicia la aplicación.

3. Los logs de sincronización, cambios y errores aparecerán en la consola.
