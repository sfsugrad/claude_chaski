'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { authAPI, messagesAPI, UserResponse, ConversationSummary, MessageResponse } from '@/lib/api'
import Navbar from '@/components/Navbar'
import ChatWindow from '@/components/ChatWindow'
import { useWebSocket } from '@/hooks/useWebSocket'

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

export default function MessagesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Get package ID from URL if present
  useEffect(() => {
    const packageIdParam = searchParams.get('package')
    if (packageIdParam) {
      setSelectedPackageId(parseInt(packageIdParam, 10))
    }
  }, [searchParams])

  // Handle incoming WebSocket messages
  const handleMessageReceived = useCallback((message: MessageResponse) => {
    // Update conversation list with new message
    setConversations(prev => {
      const conversationIndex = prev.findIndex(c => c.package_id === message.package_id)
      if (conversationIndex === -1) {
        // New conversation - reload the list
        loadConversations()
        return prev
      }

      const updated = [...prev]
      const conversation = { ...updated[conversationIndex] }
      conversation.last_message = message.content.slice(0, 100)
      conversation.last_message_at = message.created_at
      if (message.package_id !== selectedPackageId) {
        conversation.unread_count += 1
      }
      updated[conversationIndex] = conversation

      // Move to top
      updated.splice(conversationIndex, 1)
      updated.unshift(conversation)

      return updated
    })
  }, [selectedPackageId])

  // Initialize WebSocket
  useWebSocket({
    onMessageReceived: handleMessageReceived,
  })

  const loadConversations = async () => {
    try {
      const response = await messagesAPI.getConversations()
      setConversations(response.data.conversations)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const userResponse = await authAPI.getCurrentUser()
        setUser(userResponse.data)
        await loadConversations()
      } catch (err) {
        setError('Please log in to view messages.')
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  const handleSelectConversation = (packageId: number) => {
    setSelectedPackageId(packageId)
    // Update URL without full navigation
    window.history.pushState({}, '', `/messages?package=${packageId}`)

    // Mark as read locally
    setConversations(prev =>
      prev.map(c =>
        c.package_id === packageId ? { ...c, unread_count: 0 } : c
      )
    )
  }

  const selectedConversation = conversations.find(c => c.package_id === selectedPackageId)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block"
          >
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-600 mt-1">Chat with senders and couriers about packages</p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="flex h-[600px]">
            {/* Conversation List - Sidebar */}
            <div className={`w-full md:w-1/3 border-r border-gray-200 ${selectedPackageId ? 'hidden md:block' : ''}`}>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
              </div>

              <div className="overflow-y-auto h-[calc(100%-57px)]">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="text-4xl mb-4">💬</div>
                    <p className="text-gray-600">No conversations yet</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Messages will appear here when you chat about packages
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {conversations.map((conversation) => (
                      <li key={conversation.package_id}>
                        <button
                          onClick={() => handleSelectConversation(conversation.package_id)}
                          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                            selectedPackageId === conversation.package_id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {conversation.other_user_name}
                              </p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                Package: {conversation.package_description}
                              </p>
                              <p className="text-sm text-gray-600 truncate mt-1">
                                {conversation.last_message}
                              </p>
                            </div>
                            <div className="ml-3 flex flex-col items-end">
                              <span className="text-xs text-gray-400">
                                {formatTimeAgo(conversation.last_message_at)}
                              </span>
                              {conversation.unread_count > 0 && (
                                <span className="mt-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                                  {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Chat Area */}
            <div className={`flex-1 flex flex-col ${!selectedPackageId ? 'hidden md:flex' : ''}`}>
              {selectedPackageId && user ? (
                <>
                  {/* Mobile back button */}
                  <div className="md:hidden p-3 border-b border-gray-200 bg-gray-50">
                    <button
                      onClick={() => {
                        setSelectedPackageId(null)
                        window.history.pushState({}, '', '/messages')
                      }}
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to conversations
                    </button>
                  </div>

                  {/* Package info header */}
                  {selectedConversation && (
                    <div className="p-3 border-b border-gray-200 bg-gray-50 hidden md:block">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedConversation.other_user_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Package: {selectedConversation.package_description}
                          </p>
                        </div>
                        <Link
                          href={`/packages/${selectedPackageId}`}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          View Package
                        </Link>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-hidden">
                    <ChatWindow
                      packageId={selectedPackageId}
                      currentUserId={user.id}
                      otherUserName={selectedConversation?.other_user_name}
                      className="h-full border-0 rounded-none"
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-5xl mb-4">💬</div>
                    <p className="text-lg font-medium">Select a conversation</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Choose a conversation from the list to start chatting
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
