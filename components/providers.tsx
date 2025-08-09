"use client"

import type React from "react"

import { Provider } from "react-redux"
import { store } from "@/lib/store"
import { useEffect } from "react"
import { useAppDispatch } from "@/lib/hooks"
import { loadUserFromStorage } from "@/lib/store/authSlice"
import { initializeDefaultUsers } from "@/lib/database"
import { loginOnlineToCouchDB, startSync } from "@/lib/database"
import { useAppSelector } from "@/lib/hooks"

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()
  const { user, isAuthenticated } = useAppSelector(s => s.auth)

  useEffect(() => {
    initializeDefaultUsers()
    dispatch(loadUserFromStorage())
  }, [dispatch])

  // ⬇️ Nuevo: al volver online, intenta sesión en CouchDB y activa sync
  useEffect(() => {
    const onOnline = async () => {
      try {
        // Necesitamos credenciales para _session; usamos las del usuario local
        if (isAuthenticated && user?.email && user?.password) {
          const ok = await loginOnlineToCouchDB(user.email, user.password)
          if (ok) startSync()
        }
      } catch (e) {
        console.error("Re-sync al volver online falló:", e)
      }
    }
    window.addEventListener("online", onOnline)
    return () => window.removeEventListener("online", onOnline)
  }, [isAuthenticated, user])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>{children}</AuthInitializer>
    </Provider>
  )
}
