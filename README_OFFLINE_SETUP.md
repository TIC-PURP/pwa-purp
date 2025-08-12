# Configuración offline-first con API Proxy

## Variables (Vercel → Production)
- COUCHDB_BASE_URL = https://d2zfthqcwakql2.cloudfront.net
- COUCHDB_USER = campo01
- COUCHDB_PASS = ClaveCampo#2025
- NEXT_PUBLIC_COUCHDB_URL = /api/couch/gestion_pwa  (cliente apunta a la API)

## Qué cambió
- app/api/couch/[...path]/route.ts → proxy (Edge) que agrega Authorization y reenvía a CouchDB
- pages/api/couch/[...path].ts    → proxy (Pages Router) por compatibilidad
- src/lib/pouch.ts                → crea local/remote y sync continuo
- src/lib/auth.ts                 → login offline-first (local primero; online para bootstrap)
- src/context/DbProvider.tsx      → provider para exponer DBs y estado online

## Instala dependencias
npm i pouchdb-browser pouchdb-find bcryptjs

## Uso en código
import DbProvider from '@/src/context/DbProvider'
import { loginOfflineFirst, createUserOnline } from '@/src/lib/auth'

// luego monta <DbProvider> en tu layout o en _app.tsx
