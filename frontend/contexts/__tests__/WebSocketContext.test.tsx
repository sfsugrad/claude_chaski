import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import { WebSocketProvider, useWebSocketContext } from '../WebSocketContext'

// Mock useWebSocket hook
const mockUseWebSocket = {
  connectionStatus: 'connected' as const,
  isConnected: true,
  markNotificationRead: jest.fn(),
  requestUnreadCount: jest.fn(),
}

// Store callbacks for testing
let capturedCallbacks: {
  onMessageReceived?: (message: any) => void
  onNotification?: (notification: any) => void
  onUnreadCountUpdate?: (count: number) => void
} = {}

jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: (options: any) => {
    capturedCallbacks = {
      onMessageReceived: options?.onMessageReceived,
      onNotification: options?.onNotification,
      onUnreadCountUpdate: options?.onUnreadCountUpdate,
    }
    return mockUseWebSocket
  },
}))

// Test component that uses the context
function TestConsumer({ onValue }: { onValue: (ctx: any) => void }) {
  const context = useWebSocketContext()
  React.useEffect(() => {
    onValue(context)
  }, [context, onValue])
  return <div data-testid="consumer">Connected: {context.isConnected.toString()}</div>
}

// Test component for message subscription
function MessageSubscriber({
  onMessage,
}: {
  onMessage: (message: any) => void
}) {
  const { onMessageReceived } = useWebSocketContext()

  React.useEffect(() => {
    const unsubscribe = onMessageReceived(onMessage)
    return unsubscribe
  }, [onMessageReceived, onMessage])

  return <div data-testid="message-subscriber">Subscribed</div>
}

// Test component for notification subscription
function NotificationSubscriber({
  onNotification,
}: {
  onNotification: (notification: any) => void
}) {
  const { onNotification: subscribe } = useWebSocketContext()

  React.useEffect(() => {
    const unsubscribe = subscribe(onNotification)
    return unsubscribe
  }, [subscribe, onNotification])

  return <div data-testid="notification-subscriber">Subscribed</div>
}

// Test component for unread count subscription
function UnreadCountSubscriber({
  onCount,
}: {
  onCount: (count: number) => void
}) {
  const { onUnreadCountUpdate } = useWebSocketContext()

  React.useEffect(() => {
    const unsubscribe = onUnreadCountUpdate(onCount)
    return unsubscribe
  }, [onUnreadCountUpdate, onCount])

  return <div data-testid="unread-subscriber">Subscribed</div>
}

describe('WebSocketContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedCallbacks = {}
  })

  describe('Provider', () => {
    it('renders children', () => {
      render(
        <WebSocketProvider>
          <div data-testid="child">Hello</div>
        </WebSocketProvider>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('provides connection status', () => {
      const onValue = jest.fn()

      render(
        <WebSocketProvider>
          <TestConsumer onValue={onValue} />
        </WebSocketProvider>
      )

      expect(onValue).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionStatus: 'connected',
          isConnected: true,
        })
      )
    })

    it('provides markNotificationRead function', () => {
      const onValue = jest.fn()

      render(
        <WebSocketProvider>
          <TestConsumer onValue={onValue} />
        </WebSocketProvider>
      )

      const context = onValue.mock.calls[0][0]
      context.markNotificationRead(123)

      expect(mockUseWebSocket.markNotificationRead).toHaveBeenCalledWith(123)
    })

    it('provides requestUnreadCount function', () => {
      const onValue = jest.fn()

      render(
        <WebSocketProvider>
          <TestConsumer onValue={onValue} />
        </WebSocketProvider>
      )

      const context = onValue.mock.calls[0][0]
      context.requestUnreadCount()

      expect(mockUseWebSocket.requestUnreadCount).toHaveBeenCalled()
    })
  })

  describe('useWebSocketContext', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      expect(() => {
        render(<TestConsumer onValue={() => {}} />)
      }).toThrow('useWebSocketContext must be used within a WebSocketProvider')

      consoleSpy.mockRestore()
    })
  })

  describe('Message Subscriptions', () => {
    it('allows subscribing to messages', () => {
      const onMessage = jest.fn()

      render(
        <WebSocketProvider>
          <MessageSubscriber onMessage={onMessage} />
        </WebSocketProvider>
      )

      expect(screen.getByTestId('message-subscriber')).toBeInTheDocument()
    })

    it('broadcasts messages to all subscribers', () => {
      const onMessage1 = jest.fn()
      const onMessage2 = jest.fn()

      render(
        <WebSocketProvider>
          <MessageSubscriber onMessage={onMessage1} />
          <MessageSubscriber onMessage={onMessage2} />
        </WebSocketProvider>
      )

      // Simulate receiving a message through the hook
      act(() => {
        capturedCallbacks.onMessageReceived?.({
          id: 1,
          content: 'Test message',
        })
      })

      expect(onMessage1).toHaveBeenCalledWith({ id: 1, content: 'Test message' })
      expect(onMessage2).toHaveBeenCalledWith({ id: 1, content: 'Test message' })
    })

    it('unsubscribes when component unmounts', () => {
      const onMessage = jest.fn()

      const { unmount } = render(
        <WebSocketProvider>
          <MessageSubscriber onMessage={onMessage} />
        </WebSocketProvider>
      )

      unmount()

      // After unmount, callback should not be called
      act(() => {
        capturedCallbacks.onMessageReceived?.({
          id: 1,
          content: 'Test message',
        })
      })

      expect(onMessage).not.toHaveBeenCalled()
    })
  })

  describe('Notification Subscriptions', () => {
    it('broadcasts notifications to all subscribers', () => {
      const onNotification1 = jest.fn()
      const onNotification2 = jest.fn()

      render(
        <WebSocketProvider>
          <NotificationSubscriber onNotification={onNotification1} />
          <NotificationSubscriber onNotification={onNotification2} />
        </WebSocketProvider>
      )

      act(() => {
        capturedCallbacks.onNotification?.({
          id: 1,
          message: 'New notification',
        })
      })

      expect(onNotification1).toHaveBeenCalledWith({ id: 1, message: 'New notification' })
      expect(onNotification2).toHaveBeenCalledWith({ id: 1, message: 'New notification' })
    })

    it('unsubscribes when component unmounts', () => {
      const onNotification = jest.fn()

      const { unmount } = render(
        <WebSocketProvider>
          <NotificationSubscriber onNotification={onNotification} />
        </WebSocketProvider>
      )

      unmount()

      act(() => {
        capturedCallbacks.onNotification?.({
          id: 1,
          message: 'New notification',
        })
      })

      expect(onNotification).not.toHaveBeenCalled()
    })
  })

  describe('Unread Count Subscriptions', () => {
    it('broadcasts unread count updates to all subscribers', () => {
      const onCount1 = jest.fn()
      const onCount2 = jest.fn()

      render(
        <WebSocketProvider>
          <UnreadCountSubscriber onCount={onCount1} />
          <UnreadCountSubscriber onCount={onCount2} />
        </WebSocketProvider>
      )

      act(() => {
        capturedCallbacks.onUnreadCountUpdate?.(5)
      })

      expect(onCount1).toHaveBeenCalledWith(5)
      expect(onCount2).toHaveBeenCalledWith(5)
    })

    it('unsubscribes when component unmounts', () => {
      const onCount = jest.fn()

      const { unmount } = render(
        <WebSocketProvider>
          <UnreadCountSubscriber onCount={onCount} />
        </WebSocketProvider>
      )

      unmount()

      act(() => {
        capturedCallbacks.onUnreadCountUpdate?.(10)
      })

      expect(onCount).not.toHaveBeenCalled()
    })
  })

  describe('Multiple Subscription Types', () => {
    it('handles multiple subscription types simultaneously', () => {
      const onMessage = jest.fn()
      const onNotification = jest.fn()
      const onCount = jest.fn()

      render(
        <WebSocketProvider>
          <MessageSubscriber onMessage={onMessage} />
          <NotificationSubscriber onNotification={onNotification} />
          <UnreadCountSubscriber onCount={onCount} />
        </WebSocketProvider>
      )

      act(() => {
        capturedCallbacks.onMessageReceived?.({ id: 1, content: 'Message' })
        capturedCallbacks.onNotification?.({ id: 2, message: 'Notification' })
        capturedCallbacks.onUnreadCountUpdate?.(3)
      })

      expect(onMessage).toHaveBeenCalledWith({ id: 1, content: 'Message' })
      expect(onNotification).toHaveBeenCalledWith({ id: 2, message: 'Notification' })
      expect(onCount).toHaveBeenCalledWith(3)
    })
  })
})
