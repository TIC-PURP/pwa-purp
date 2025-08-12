'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { User, CreateUserData, Role, Permission } from '@/lib/types'

const allPermissions: Permission[] = ["app_access","users_read","users_write","users_delete"]

export function UserForm({
  user,
  onSubmit,
  onCancel,
  isLoading,
}: {
  user?: User
  onSubmit: (data: CreateUserData | Partial<CreateUserData>) => void | Promise<void>
  onCancel: () => void
  isLoading?: boolean
}) {
  const isEditing = !!user
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('') // solo creación/edición
  const [role, setRole] = useState<Role>((user?.role as Role) || 'user')
  const [permissions, setPermissions] = useState<Permission[]>(
    (user?.permissions as Permission[]) || ['app_access']
  )

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
      setRole(user.role as Role)
      setPermissions((user.permissions as Permission[]) || [])
    }
  }, [user])

  const togglePerm = (p: Permission) => {
    setPermissions((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const data: any = { name, email, role, permissions }
    if (password) data.password = password
    await onSubmit(data)
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nombre</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Contraseña</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isEditing ? "Dejar vacío para no cambiar" : ""}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Rol</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="user">user</option>
              <option value="manager">manager</option>
              <option value="administrador">administrador</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Permisos</label>
            <div className="flex flex-wrap gap-3">
              {allPermissions.map((p) => (
                <label key={p} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permissions.includes(p)}
                    onChange={() => togglePerm(p)}
                  />
                  <span className="text-sm">{p}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={!!isLoading}>
              {isEditing ? (isLoading ? "Guardando..." : "Guardar Cambios") : (isLoading ? "Creando..." : "Crear Usuario")}
            </Button>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
