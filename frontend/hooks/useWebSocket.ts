'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

export type WebSocketEventType =
  | 'notification_created'
  | 'unread_count_updated'
  | 'package_updated'
  | 'message_received'
  | 'pong'

export interface ChatMessage {
  id: number
  package_id: number
  sender_id: number
  sender_name: string
  content: string
  is_read: boolean
  created_at: string
}

export interface WebSocketMessage {
  event_type: WebSocketEventType
  notification?: {
    id: number
    user_id: number
    type: string
    message: string
    read: boolean
    package_id: number | null
    created_at: string
  }
  count?: number
  package?: any
  message?: ChatMessage
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseWebSocketOptions {
  onNotification?: (notification: WebSocketMessage['notification']) => void
  onUnreadCountUpdate?: (count: number) => void
  onPackageUpdate?: (pkg: any) => void
  onMessageReceived?: (message: ChatMessage) => void
  onConnectionChange?: (status: ConnectionStatus) => void
  reconnectAttempts?: number
  reconnectInterval?: number
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onNotification,
    onUnreadCountUpdate,
    onPackageUpdate,
    onMessageReceived,
    onConnectionChange,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
  } = options

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const updateStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status)
    onConnectionChange?.(status)
  }, [onConnectionChange])

  const connect = useCallback(() => {
    // Get token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

    if (!token) {
      updateStatus('disconnected')
      return
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close()
    }

    updateStatus('connecting')

    try {
      const ws = new WebSocket(`${WS_URL}/api/ws?token=${token}`)
      wsRef.current = ws

      ws.onopen = () => {
        updateStatus('connected')
        reconnectCountRef.current = 0

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'ping' }))
          }
        }, 25000) // Send ping every 25 seconds
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)

          switch (message.event_type) {
            case 'notification_created':
              if (message.notification) {
                onNotification?.(message.notification)
              }
              break
            case 'unread_count_updated':
              if (typeof message.count === 'number') {
                onUnreadCountUpdate?.(message.count)
              }
              break
            case 'package_updated':
              if (message.package) {
                onPackageUpdate?.(message.package)
              }
              break
            case 'message_received':
              if (message.message) {
                onMessageReceived?.(message.message)
              }
              break
            case 'pong':
              // Connection is alive, nothing to do
              break
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }

      ws.onerror = () => {
        updateStatus('error')
      }

      ws.onclose = (event) => {
        updateStatus('disconnected')

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Attempt to reconnect if not a normal closure and we haven't exceeded attempts
        if (event.code !== 1000 && reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval * reconnectCountRef.current) // Exponential backoff
        }
      }
    } catch (err) {
      console.error('WebSocket connection error:', err)
      updateStatus('error')
    }
  }, [onNotification, onUnreadCountUpdate, onPackageUpdate, onMessageReceived, updateStatus, reconnectAttempts, reconnectInterval])

  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

    // Close connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected')
      wsRef.current = null
    }

    updateStatus('disconnected')
  }, [updateStatus])

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const markNotificationRead = useCallback((notificationId: number) => {
    sendMessage({ action: 'mark_read', notification_id: notificationId })
  }, [sendMessage])

  const requestUnreadCount = useCallback(() => {
    sendMessage({ action: 'get_unread_count' })
  }, [sendMessage])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reconnect when token changes
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'token') {
        if (event.newValue) {
          connect()
        } else {
          disconnect()
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [connect, disconnect])

  return {
    connectionStatus,
    lastMessage,
    connect,
    disconnect,
    sendMessage,
    markNotificationRead,
    requestUnreadCount,
    isConnected: connectionStatus === 'connected',
  }
}
