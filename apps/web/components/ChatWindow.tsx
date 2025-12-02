'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { messagesAPI, MessageResponse } from '@/lib/api'
import { useWebSocketContext } from '@/contexts/WebSocketContext'

interface ChatWindowProps {
  trackingId: string
  currentUserId: number
  otherUserName?: string
  onNewMessage?: (message: MessageResponse) => void
  className?: string
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  if (isYesterday) {
    return `Yesterday ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function ChatWindow({
  trackingId,
  currentUserId,
  otherUserName = 'User',
  onNewMessage,
  className = ''
}: ChatWindowProps) {
  const [messages, setMessages] = useState<MessageResponse[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Get shared WebSocket context
  const { onMessageReceived } = useWebSocketContext()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const loadMessages = useCallback(async () => {
    try {
      setError(null)
      const response = await messagesAPI.getPackageMessages(trackingId)
      setMessages(response.data.messages)

      // Mark messages as read
      await messagesAPI.markAllAsRead(trackingId)
    } catch (err) {
      setError('Failed to load messages')
      console.error('Failed to load messages:', err)
    } finally {
      setLoading(false)
    }
  }, [trackingId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Subscribe to WebSocket message events
  useEffect(() => {
    const unsubscribe = onMessageReceived((message: any) => {
      if (message.tracking_id === trackingId) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === message.id)) return prev
          return [...prev, message]
        })
        // Mark as read since chat is open
        messagesAPI.markAsRead(message.id).catch(console.error)
      }
    })
    return unsubscribe
  }, [onMessageReceived, trackingId])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || sending) return

    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)

    try {
      const response = await messagesAPI.sendMessage(trackingId, content)
      setMessages(prev => [...prev, response.data])
      onNewMessage?.(response.data)
    } catch (err) {
      setError('Failed to send message')
      setNewMessage(content) // Restore message on error
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e as unknown as React.FormEvent)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="text-sm font-semibold text-gray-900">
          Chat with {otherUserName}
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]">
        {error && (
          <div className="text-center text-sm text-red-600 py-2">
            {error}
            <button
              onClick={loadMessages}
              className="ml-2 text-blue-600 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {messages.length === 0 && !error ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm">No messages yet</p>
            <p className="text-xs text-gray-400 mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.sender_id === currentUserId
            return (
              <div
                key={message.id}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {!isOwnMessage && (
                    <p className="text-xs font-medium mb-1 opacity-75">
                      {message.sender_name}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-blue-200' : 'text-gray-400'
                    }`}
                  >
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={2000}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
