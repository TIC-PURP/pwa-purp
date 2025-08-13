'use client'

import { useEffect, useRef } from 'react'
import { getLocalDB, getRemoteDB, startSync } from '@/lib/database'

export default function HomePage() {
  const syncRef = useRef<any>(null)

  useEffect(() => {
    console.log('Ejecutando startSync desde HomePage')
    const local = getLocalDB()      // crea IndexedDB local (usa el nombre de tu DB)
    const remote = getRemoteDB()    // usa NEXT_PUBLIC_COUCHDB_URL (p.ej. /api/couch/gestion_pwa)
    const handler = startSync(local, remote)
    syncRef.current = handler

    // Limpieza al desmontar para no dejar sync duplicado
    return () => {
      try { syncRef.current?.cancel?.() } catch {}
    }
  }, [])

  return <div>Sync activo</div>
}
