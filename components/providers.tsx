'use client'

import { Provider } from 'react-redux'
import { store } from '@/lib/store'
import { Toaster } from '@/components/ui/sonner'
import React from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      {children}
      <Toaster richColors position="top-right" />
    </Provider>
  )
}
