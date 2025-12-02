import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatWindow from '../ChatWindow'

// Mock scrollIntoView which is not available in jsdom
window.HTMLElement.prototype.scrollIntoView = jest.fn()

// Mock the API functions
const mockGetPackageMessages = jest.fn()
const mockSendMessage = jest.fn()
const mockMarkAllAsRead = jest.fn()
const mockMarkAsRead = jest.fn()

jest.mock('@/lib/api', () => ({
  messagesAPI: {
    getPackageMessages: (...args: any[]) => mockGetPackageMessages(...args),
    sendMessage: (...args: any[]) => mockSendMessage(...args),
    markAllAsRead: (...args: any[]) => mockMarkAllAsRead(...args),
    markAsRead: (...args: any[]) => mockMarkAsRead(...args),
  },
}))

// Mock WebSocket context
const mockOnMessageReceived = jest.fn()

jest.mock('@/contexts/WebSocketContext', () => ({
  useWebSocketContext: () => ({
    onMessageReceived: mockOnMessageReceived,
  }),
}))

describe('ChatWindow', () => {
  const defaultProps = {
    packageId: 1,
    currentUserId: 100,
    otherUserName: 'John Doe',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockOnMessageReceived.mockReturnValue(() => {}) // Return unsubscribe function
  })

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      mockGetPackageMessages.mockImplementation(() => new Promise(() => {}))

      const { container } = render(<ChatWindow {...defaultProps} />)

      // Check for loading spinner - it should have animate-spin class
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeTruthy()
    })
  })

  describe('Empty State', () => {
    it('shows no messages placeholder when empty', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/no messages yet/i)).toBeInTheDocument()
      })
    })

    it('shows prompt to start conversation', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/send a message to start/i)).toBeInTheDocument()
      })
    })
  })

  describe('Messages Display', () => {
    const mockMessages = [
      {
        id: 1,
        package_id: 1,
        sender_id: 100,
        sender_name: 'Me',
        content: 'Hello!',
        is_read: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        package_id: 1,
        sender_id: 200,
        sender_name: 'John Doe',
        content: 'Hi there!',
        is_read: true,
        created_at: new Date().toISOString(),
      },
    ]

    it('displays messages', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: mockMessages } })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Hello!')).toBeInTheDocument()
        expect(screen.getByText('Hi there!')).toBeInTheDocument()
      })
    })

    it('shows sender name for other user messages', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: mockMessages } })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })

    it('styles own messages differently', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: mockMessages } })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        const helloMessage = screen.getByText('Hello!').closest('div')
        expect(helloMessage).toHaveClass('bg-blue-600')
      })
    })

    it('styles other user messages differently', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: mockMessages } })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        const hiMessage = screen.getByText('Hi there!').closest('div')
        expect(hiMessage).toHaveClass('bg-gray-100')
      })
    })
  })

  describe('Chat Header', () => {
    it('displays other user name in header', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/chat with john doe/i)).toBeInTheDocument()
      })
    })

    it('uses default name when not provided', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })

      render(<ChatWindow packageId={1} currentUserId={100} />)

      await waitFor(() => {
        expect(screen.getByText(/chat with user/i)).toBeInTheDocument()
      })
    })
  })

  describe('Sending Messages', () => {
    beforeEach(() => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })
    })

    it('has message input field', async () => {
      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
      })
    })

    it('has send button', async () => {
      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '' })).toBeInTheDocument()
      })
    })

    it('disables send button when input is empty', async () => {
      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        const sendButton = screen.getByRole('button')
        expect(sendButton).toBeDisabled()
      })
    })

    it('enables send button when input has text', async () => {
      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/type a message/i)
      await userEvent.type(input, 'Hello!')

      const sendButton = screen.getByRole('button')
      expect(sendButton).not.toBeDisabled()
    })

    it('calls sendMessage API when submitting', async () => {
      mockSendMessage.mockResolvedValue({
        data: {
          id: 1,
          package_id: 1,
          sender_id: 100,
          sender_name: 'Me',
          content: 'Test message',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/type a message/i)
      await userEvent.type(input, 'Test message')

      const form = input.closest('form')
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith(1, 'Test message')
      })
    })

    it('clears input after sending', async () => {
      mockSendMessage.mockResolvedValue({
        data: {
          id: 1,
          package_id: 1,
          sender_id: 100,
          sender_name: 'Me',
          content: 'Test message',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/type a message/i) as HTMLInputElement
      await userEvent.type(input, 'Test message')

      const form = input.closest('form')
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(input.value).toBe('')
      })
    })

    it('sends message on Enter key', async () => {
      mockSendMessage.mockResolvedValue({
        data: {
          id: 1,
          package_id: 1,
          sender_id: 100,
          sender_name: 'Me',
          content: 'Test message',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/type a message/i)
      await userEvent.type(input, 'Test message{enter}')

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message on load failure', async () => {
      mockGetPackageMessages.mockRejectedValue(new Error('Failed to load'))

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      mockGetPackageMessages.mockRejectedValue(new Error('Failed to load'))

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText(/retry/i)).toBeInTheDocument()
      })
    })

    it('shows error message on send failure', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })
      mockSendMessage.mockRejectedValue(new Error('Failed to send'))

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument()
      })

      const input = screen.getByPlaceholderText(/type a message/i)
      await userEvent.type(input, 'Test message')

      const form = input.closest('form')
      fireEvent.submit(form!)

      await waitFor(() => {
        expect(screen.getByText(/failed to send/i)).toBeInTheDocument()
      })
    })
  })

  describe('WebSocket Integration', () => {
    it('subscribes to message events on mount', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(mockOnMessageReceived).toHaveBeenCalled()
      })
    })

    it('unsubscribes on unmount', async () => {
      const unsubscribe = jest.fn()
      mockOnMessageReceived.mockReturnValue(unsubscribe)
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })

      const { unmount } = render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(mockOnMessageReceived).toHaveBeenCalled()
      })

      unmount()

      expect(unsubscribe).toHaveBeenCalled()
    })
  })

  describe('Mark Messages as Read', () => {
    it('marks all messages as read on load', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })

      render(<ChatWindow {...defaultProps} />)

      await waitFor(() => {
        expect(mockMarkAllAsRead).toHaveBeenCalledWith(1)
      })
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className', async () => {
      mockGetPackageMessages.mockResolvedValue({ data: { messages: [] } })

      const { container } = render(
        <ChatWindow {...defaultProps} className="custom-class" />
      )

      await waitFor(() => {
        expect(container.firstChild).toHaveClass('custom-class')
      })
    })
  })
})
