'use client'

import { createContext, useContext, useCallback, useRef, ReactNode } from 'react'
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
  // Store callbacks in refs to avoid stale closure issues
  const messageCallbacksRef = useRef<Set<(message: ChatMessage) => void>>(new Set())
  const notificationCallbacksRef = useRef<Set<(notification: any) => void>>(new Set())
  const unreadCountCallbacksRef = useRef<Set<(count: number) => void>>(new Set())

  // Handle incoming messages and dispatch to all subscribers
  const handleMessageReceived = useCallback((message: ChatMessage) => {
    console.log('[WebSocket] Message received:', message)
    console.log('[WebSocket] Callback count:', messageCallbacksRef.current.size)
    messageCallbacksRef.current.forEach(callback => callback(message))
  }, [])

  const handleNotification = useCallback((notification: any) => {
    notificationCallbacksRef.current.forEach(callback => callback(notification))
  }, [])

  const handleUnreadCountUpdate = useCallback((count: number) => {
    unreadCountCallbacksRef.current.forEach(callback => callback(count))
  }, [])

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
    messageCallbacksRef.current.add(callback)
    console.log('[WebSocket] Added message callback, total:', messageCallbacksRef.current.size)
    // Return unsubscribe function
    return () => {
      messageCallbacksRef.current.delete(callback)
      console.log('[WebSocket] Removed message callback, total:', messageCallbacksRef.current.size)
    }
  }, [])

  // Subscribe to notification events
  const onNotification = useCallback((callback: (notification: any) => void) => {
    notificationCallbacksRef.current.add(callback)
    return () => {
      notificationCallbacksRef.current.delete(callback)
    }
  }, [])

  // Subscribe to unread count updates
  const onUnreadCountUpdate = useCallback((callback: (count: number) => void) => {
    unreadCountCallbacksRef.current.add(callback)
    return () => {
      unreadCountCallbacksRef.current.delete(callback)
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
