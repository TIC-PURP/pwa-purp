"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAppSelector } from "@/lib/hooks"

interface RouteGuardProps {
  children: React.ReactNode
  requiredRole?: "manager" | "administrador" | "user"
  redirectTo?: string
}

export function RouteGuard({ children, requiredRole, redirectTo = "/auth/login" }: RouteGuardProps) {
  const router = useRouter()
  const { isAuthenticated, user, isLoading } = useAppSelector((state) => state.auth)

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push(redirectTo)
        return
      }

      if (requiredRole && user?.role !== requiredRole) {
        router.push("/principal")
        return
      }
    }
  }, [isAuthenticated, user, requiredRole, router, redirectTo, isLoading])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-900"></div>
      </div>
    )
  }

  if (!isAuthenticated || (requiredRole && user?.role !== requiredRole)) {
    return null
  }

  return <>{children}</>
}
