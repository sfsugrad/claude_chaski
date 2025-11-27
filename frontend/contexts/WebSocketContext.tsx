'use client'

import { createContext, useContext, useCallback, useState, useEffect, ReactNode } from 'react'
import { useWebSocket, ConnectionStatus, ChatMessage } from '@/hooks/useWebSocket'

interface WebSocketContextType {
  connectionStatus: ConnectionStatus
  isConnected: boolean
  // Message callbacks
  onMessageReceived: (callback: (message: ChatMessage) => void) => () => void
  // Notification callbacks
  onNotification: (callback: (notification: any) => void) => () => void
  onUnreadCountUpdate: (callback: (count: number) => void) => () => void
  // Actions
  markNotificationRead: (notificationId: number) => void
  requestUnreadCount: () => void
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  // Store callbacks in refs to allow multiple subscribers
  const [messageCallbacks, setMessageCallbacks] = useState<Set<(message: ChatMessage) => void>>(new Set())
  const [notificationCallbacks, setNotificationCallbacks] = useState<Set<(notification: any) => void>>(new Set())
  const [unreadCountCallbacks, setUnreadCountCallbacks] = useState<Set<(count: number) => void>>(new Set())

  // Handle incoming messages and dispatch to all subscribers
  const handleMessageReceived = useCallback((message: ChatMessage) => {
    messageCallbacks.forEach(callback => callback(message))
  }, [messageCallbacks])

  const handleNotification = useCallback((notification: any) => {
    notificationCallbacks.forEach(callback => callback(notification))
  }, [notificationCallbacks])

  const handleUnreadCountUpdate = useCallback((count: number) => {
    unreadCountCallbacks.forEach(callback => callback(count))
  }, [unreadCountCallbacks])

  // Single WebSocket connection for the entire app
  const {
    connectionStatus,
    isConnected,
    markNotificationRead,
    requestUnreadCount
  } = useWebSocket({
    onMessageReceived: handleMessageReceived,
    onNotification: handleNotification,
    onUnreadCountUpdate: handleUnreadCountUpdate,
  })

  // Subscribe to message events
  const onMessageReceived = useCallback((callback: (message: ChatMessage) => void) => {
    setMessageCallbacks(prev => new Set(prev).add(callback))
    // Return unsubscribe function
    return () => {
      setMessageCallbacks(prev => {
        const next = new Set(prev)
        next.delete(callback)
        return next
      })
    }
  }, [])

  // Subscribe to notification events
  const onNotification = useCallback((callback: (notification: any) => void) => {
    setNotificationCallbacks(prev => new Set(prev).add(callback))
    return () => {
      setNotificationCallbacks(prev => {
        const next = new Set(prev)
        next.delete(callback)
        return next
      })
    }
  }, [])

  // Subscribe to unread count updates
  const onUnreadCountUpdate = useCallback((callback: (count: number) => void) => {
    setUnreadCountCallbacks(prev => new Set(prev).add(callback))
    return () => {
      setUnreadCountCallbacks(prev => {
        const next = new Set(prev)
        next.delete(callback)
        return next
      })
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{
      connectionStatus,
      isConnected,
      onMessageReceived,
      onNotification,
      onUnreadCountUpdate,
      markNotificationRead,
      requestUnreadCount,
    }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider')
  }
  return context
}
