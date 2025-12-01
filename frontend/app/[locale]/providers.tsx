'use client'

import { ReactNode } from 'react'
import { WebSocketProvider } from '@/contexts/WebSocketContext'
import VerificationBanner from '@/components/VerificationBanner'
import UnverifiedCourierGuard from '@/components/UnverifiedCourierGuard'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WebSocketProvider>
      <UnverifiedCourierGuard>
        <VerificationBanner />
        {children}
      </UnverifiedCourierGuard>
    </WebSocketProvider>
  )
}
