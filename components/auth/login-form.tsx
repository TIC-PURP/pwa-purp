'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { loginUser } from '@/lib/store/authSlice'
import { toast } from 'sonner'

type LoginCredentials = { email: string; password: string }

export function LoginForm() {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const [form, setForm] = useState<LoginCredentials>({ email: '', password: '' })
  const { isLoading } = useAppSelector((s) => s.auth)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await dispatch(loginUser(form))
    if (loginUser.fulfilled.match(res)) {
      toast.success('Inicio de sesión exitoso')
      router.push('/principal')
    } else {
      toast.error((res.payload as string) || 'Error al iniciar sesión')
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm">Email</label>
        <input
          type="email"
          className="border rounded px-3 py-2"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm">Contraseña</label>
        <input
          type="password"
          className="border rounded px-3 py-2"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-60"
      >
        {isLoading ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  )
}
