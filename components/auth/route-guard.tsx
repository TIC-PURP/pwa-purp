'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppSelector } from '@/lib/hooks'
import type { Role } from '@/lib/types'

export function RouteGuard({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole?: Role
}) {
  const router = useRouter()
  const { user, isAuthenticated } = useAppSelector((s) => s.auth)

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login')
      return
    }
    if (requiredRole && user) {
      const role = user.role
      if (requiredRole === 'manager' && !(role === 'manager' || role === 'administrador')) {
        router.replace('/principal')
      }
    }
  }, [isAuthenticated, requiredRole, user, router])

  if (!isAuthenticated) return null
  return <>{children}</>
}
