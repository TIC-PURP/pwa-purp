'use client'
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm border rounded-xl p-6 shadow-sm bg-white">
        <h1 className="text-2xl font-bold mb-2">Iniciar sesión</h1>
        <p className="text-sm text-gray-600 mb-6">
          Usa tus credenciales de CouchDB.
        </p>
        <LoginForm />
      </div>
    </div>
  )
}
