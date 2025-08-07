'use client'

import { useEffect, useState } from 'react'

export default function ConnectionTest() {
  const [status, setStatus] = useState<'success' | 'error' | 'loading'>('loading')
  const [message, setMessage] = useState<string>('Verificando conexión con CouchDB...')

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_COUCHDB_URL

    if (!url) {
      setStatus('error')
      setMessage('❌ Variable NEXT_PUBLIC_COUCHDB_URL no definida')
      return
    }

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Código de estado: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        console.log('✅ Conexión exitosa con CouchDB desde Vercel:', data)
        setStatus('success')
        setMessage('✅ Conexión exitosa con CouchDB')
      })
      .catch((err) => {
        console.error('❌ Error al conectar con CouchDB desde Vercel:', err)
        setStatus('error')
        setMessage(`❌ Error al conectar con CouchDB: ${err.message}`)
      })
  }, [])

  return (
    <div
      className={`text-center py-2 text-sm font-semibold ${
        status === 'success'
          ? 'bg-green-100 text-green-800'
          : status === 'error'
          ? 'bg-red-100 text-red-800'
          : 'bg-yellow-100 text-yellow-800'
      }`}
    >
      {message}
    </div>
  )
}
