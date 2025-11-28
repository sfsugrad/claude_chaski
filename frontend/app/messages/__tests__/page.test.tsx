import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter, useSearchParams } from 'next/navigation'
import MessagesPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}))

// Mock API functions
const mockGetCurrentUser = jest.fn()
const mockGetConversations = jest.fn()

jest.mock('@/lib/api', () => ({
  authAPI: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
  messagesAPI: {
    getConversations: () => mockGetConversations(),
  },
}))

// Mock Navbar
jest.mock('@/components/Navbar', () => {
  return function MockNavbar({ user }: { user: any }) {
    return <nav data-testid="navbar">Navbar for {user?.full_name}</nav>
  }
})

// Mock ChatWindow
jest.mock('@/components/ChatWindow', () => {
  return function MockChatWindow({
    packageId,
    currentUserId,
    otherUserName,
  }: {
    packageId: number
    currentUserId: number
    otherUserName?: string
  }) {
    return (
      <div data-testid="chat-window">
        Chat: Package {packageId}, User {currentUserId}, With {otherUserName}
      </div>
    )
  }
})

// Mock WebSocket context
const mockOnMessageReceived = jest.fn()

jest.mock('@/contexts/WebSocketContext', () => ({
  useWebSocketContext: () => ({
    onMessageReceived: mockOnMessageReceived,
  }),
}))

// Mock UI components
jest.mock('@/components/ui', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  Alert: ({ children, variant, className }: any) => <div role="alert" className={`alert-${variant} ${className || ''}`}>{children}</div>,
  Badge: ({ children, variant, size, className }: any) => <span className={`badge-${variant} ${className || ''}`}>{children}</span>,
  FadeIn: ({ children }: any) => <div>{children}</div>,
  SlideIn: ({ children }: any) => <div>{children}</div>,
  MessagesSkeleton: () => <div data-testid="messages-skeleton" className="animate-pulse">Loading...</div>,
}))

describe('MessagesPage', () => {
  const mockRouter = {
    push: jest.fn(),
  }

  const mockSearchParams = {
    get: jest.fn(),
  }

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'sender',
  }

  const mockConversations = [
    {
      package_id: 101,
      other_user_id: 2,
      other_user_name: 'John Courier',
      package_description: 'Small package to downtown',
      last_message: 'Thanks for the update!',
      last_message_at: new Date().toISOString(),
      unread_count: 2,
    },
    {
      package_id: 102,
      other_user_id: 3,
      other_user_name: 'Jane Sender',
      package_description: 'Documents for signing',
      last_message: 'When can you pick up?',
      last_message_at: new Date(Date.now() - 3600000).toISOString(),
      unread_count: 0,
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)
    mockSearchParams.get.mockReturnValue(null)
    mockOnMessageReceived.mockReturnValue(() => {}) // Return unsubscribe function
  })

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      mockGetCurrentUser.mockImplementation(() => new Promise(() => {}))
      mockGetConversations.mockImplementation(() => new Promise(() => {}))

      const { container } = render(<MessagesPage />)

      const skeleton = container.querySelector('.animate-pulse')
      expect(skeleton).toBeTruthy()
    })

    it('shows loading text', () => {
      mockGetCurrentUser.mockImplementation(() => new Promise(() => {}))
      mockGetConversations.mockImplementation(() => new Promise(() => {}))

      render(<MessagesPage />)

      expect(screen.getByTestId('messages-skeleton')).toBeInTheDocument()
    })
  })

  describe('Authentication', () => {
    it('redirects to login when not authenticated', async () => {
      mockGetCurrentUser.mockRejectedValue(new Error('Unauthorized'))

      render(<MessagesPage />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('Page Content', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue({ data: mockUser })
      mockGetConversations.mockResolvedValue({ data: { conversations: mockConversations } })
    })

    it('renders page heading', async () => {
      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText('Messages')).toBeInTheDocument()
      })
    })

    it('renders navbar with user', async () => {
      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByTestId('navbar')).toBeInTheDocument()
      })
    })

    it('renders back to dashboard link', async () => {
      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText(/back to dashboard/i)).toBeInTheDocument()
      })
    })

    it('renders conversations header', async () => {
      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText('Conversations')).toBeInTheDocument()
      })
    })
  })

  describe('Conversation List', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue({ data: mockUser })
    })

    it('renders conversation items', async () => {
      mockGetConversations.mockResolvedValue({ data: { conversations: mockConversations } })

      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText('John Courier')).toBeInTheDocument()
        expect(screen.getByText('Jane Sender')).toBeInTheDocument()
      })
    })

    it('shows package description', async () => {
      mockGetConversations.mockResolvedValue({ data: { conversations: mockConversations } })

      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText(/small package to downtown/i)).toBeInTheDocument()
      })
    })

    it('shows last message preview', async () => {
      mockGetConversations.mockResolvedValue({ data: { conversations: mockConversations } })

      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText('Thanks for the update!')).toBeInTheDocument()
      })
    })

    it('shows unread count badge', async () => {
      mockGetConversations.mockResolvedValue({ data: { conversations: mockConversations } })

      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument()
      })
    })

    it('shows empty state when no conversations', async () => {
      mockGetConversations.mockResolvedValue({ data: { conversations: [] } })

      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument()
      })
    })
  })

  describe('Conversation Selection', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue({ data: mockUser })
      mockGetConversations.mockResolvedValue({ data: { conversations: mockConversations } })
    })

    it('shows select prompt when no conversation selected', async () => {
      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText(/select a conversation/i)).toBeInTheDocument()
      })
    })

    it('selects conversation from URL param', async () => {
      mockSearchParams.get.mockReturnValue('101')

      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByTestId('chat-window')).toBeInTheDocument()
      })
    })

    it('opens chat window when conversation clicked', async () => {
      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText('John Courier')).toBeInTheDocument()
      })

      // Click on conversation
      const conversationButton = screen.getByText('John Courier').closest('button')!
      fireEvent.click(conversationButton)

      await waitFor(() => {
        expect(screen.getByTestId('chat-window')).toBeInTheDocument()
      })
    })

    it('passes correct props to ChatWindow', async () => {
      mockSearchParams.get.mockReturnValue('101')

      render(<MessagesPage />)

      await waitFor(() => {
        const chatWindow = screen.getByTestId('chat-window')
        expect(chatWindow).toHaveTextContent('Package 101')
        expect(chatWindow).toHaveTextContent('User 1')
        expect(chatWindow).toHaveTextContent('With John Courier')
      })
    })
  })

  describe('WebSocket Integration', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue({ data: mockUser })
      mockGetConversations.mockResolvedValue({ data: { conversations: mockConversations } })
    })

    it('subscribes to message events on mount', async () => {
      render(<MessagesPage />)

      await waitFor(() => {
        expect(mockOnMessageReceived).toHaveBeenCalled()
      })
    })

    it('unsubscribes on unmount', async () => {
      const unsubscribe = jest.fn()
      mockOnMessageReceived.mockReturnValue(unsubscribe)

      const { unmount } = render(<MessagesPage />)

      await waitFor(() => {
        expect(mockOnMessageReceived).toHaveBeenCalled()
      })

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('displays error state when conversations fail to load', async () => {
      mockGetCurrentUser.mockResolvedValue({ data: mockUser })
      mockGetConversations.mockRejectedValue(new Error('Failed to load'))

      render(<MessagesPage />)

      // Should still render but with empty conversations
      await waitFor(() => {
        expect(screen.getByText('Messages')).toBeInTheDocument()
      })
    })
  })

  describe('Time Formatting', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue({ data: mockUser })
    })

    it('shows "Just now" for very recent messages', async () => {
      const recentConversation = {
        ...mockConversations[0],
        last_message_at: new Date().toISOString(),
      }
      mockGetConversations.mockResolvedValue({ data: { conversations: [recentConversation] } })

      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument()
      })
    })

    it('shows relative time for older messages', async () => {
      const olderConversation = {
        ...mockConversations[0],
        last_message_at: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      }
      mockGetConversations.mockResolvedValue({ data: { conversations: [olderConversation] } })

      render(<MessagesPage />)

      await waitFor(() => {
        expect(screen.getByText('2h ago')).toBeInTheDocument()
      })
    })
  })
})
