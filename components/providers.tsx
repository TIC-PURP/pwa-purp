"use client"

import type React from "react"

import { Provider } from "react-redux"
import { store } from "@/lib/store"
import { useEffect } from "react"
import { useAppDispatch } from "@/lib/hooks"
import { loadUserFromStorage } from "@/lib/store/authSlice"
import { initializeDefaultUsers } from "@/lib/database"

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch()

  useEffect(() => {
    // Inicializar usuarios por defecto
    initializeDefaultUsers()

    // Cargar usuario desde localStorage
    dispatch(loadUserFromStorage())
  }, [dispatch])

  return <>{children}</>
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthInitializer>{children}</AuthInitializer>
    </Provider>
  )
}
