import { renderHook, act, waitFor } from '@testing-library/react'
import { useWebSocket } from '../useWebSocket'

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: any) => void) | null = null
  onmessage: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onclose: ((event: any) => void) | null = null

  constructor(url: string) {
    this.url = url
    // Simulate connection opening after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      if (this.onopen) {
        this.onopen({ type: 'open' })
      }
    }, 10)
  }

  send = jest.fn()

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) {
      this.onclose({ code: code || 1000, reason })
    }
  }

  // Helper to simulate receiving a message
  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) })
    }
  }

  // Helper to simulate an error
  simulateError() {
    if (this.onerror) {
      this.onerror({ type: 'error' })
    }
  }
}

// Store WebSocket instances for testing
let mockWebSocketInstances: MockWebSocket[] = []

// Mock global WebSocket
const originalWebSocket = global.WebSocket
beforeAll(() => {
  ;(global as any).WebSocket = jest.fn((url: string) => {
    const ws = new MockWebSocket(url)
    mockWebSocketInstances.push(ws)
    return ws
  })
  ;(global as any).WebSocket.OPEN = MockWebSocket.OPEN
  ;(global as any).WebSocket.CLOSED = MockWebSocket.CLOSED
  ;(global as any).WebSocket.CONNECTING = MockWebSocket.CONNECTING
  ;(global as any).WebSocket.CLOSING = MockWebSocket.CLOSING
})

afterAll(() => {
  ;(global as any).WebSocket = originalWebSocket
})

beforeEach(() => {
  mockWebSocketInstances = []
  jest.clearAllMocks()
  jest.useFakeTimers()

  // Mock localStorage
  Storage.prototype.getItem = jest.fn((key) => {
    if (key === 'token') return 'test-token'
    return null
  })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useWebSocket', () => {
  describe('Connection', () => {
    it('connects when token is available', async () => {
      const { result } = renderHook(() => useWebSocket())

      // Run timers to allow connection to establish
      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected')
      })
    })

    it('does not connect when no token is available', () => {
      Storage.prototype.getItem = jest.fn(() => null)

      const { result } = renderHook(() => useWebSocket())

      expect(result.current.connectionStatus).toBe('disconnected')
      expect(mockWebSocketInstances.length).toBe(0)
    })

    it('constructs WebSocket URL with token', async () => {
      renderHook(() => useWebSocket())

      await waitFor(() => {
        expect(mockWebSocketInstances.length).toBeGreaterThan(0)
      })

      expect(mockWebSocketInstances[0].url).toContain('token=test-token')
    })

    it('updates isConnected when connected', async () => {
      const { result } = renderHook(() => useWebSocket())

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })
    })
  })

  describe('Disconnection', () => {
    it('disconnects properly', async () => {
      const { result } = renderHook(() => useWebSocket())

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.connectionStatus).toBe('disconnected')
    })

    it('clears ping interval on disconnect', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      const { result } = renderHook(() => useWebSocket())

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.disconnect()
      })

      expect(clearIntervalSpy).toHaveBeenCalled()
    })
  })

  describe('Message Handling', () => {
    it('calls onNotification when notification_created event received', async () => {
      const onNotification = jest.fn()
      const { result } = renderHook(() => useWebSocket({ onNotification }))

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        mockWebSocketInstances[0].simulateMessage({
          event_type: 'notification_created',
          notification: { id: 1, message: 'Test notification' },
        })
      })

      expect(onNotification).toHaveBeenCalledWith({ id: 1, message: 'Test notification' })
    })

    it('calls onUnreadCountUpdate when unread_count_updated event received', async () => {
      const onUnreadCountUpdate = jest.fn()
      const { result } = renderHook(() => useWebSocket({ onUnreadCountUpdate }))

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        mockWebSocketInstances[0].simulateMessage({
          event_type: 'unread_count_updated',
          count: 5,
        })
      })

      expect(onUnreadCountUpdate).toHaveBeenCalledWith(5)
    })

    it('calls onMessageReceived when message_received event received', async () => {
      const onMessageReceived = jest.fn()
      const { result } = renderHook(() => useWebSocket({ onMessageReceived }))

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        mockWebSocketInstances[0].simulateMessage({
          event_type: 'message_received',
          message: { id: 1, content: 'Hello!' },
        })
      })

      expect(onMessageReceived).toHaveBeenCalledWith({ id: 1, content: 'Hello!' })
    })

    it('calls onPackageUpdate when package_updated event received', async () => {
      const onPackageUpdate = jest.fn()
      const { result } = renderHook(() => useWebSocket({ onPackageUpdate }))

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        mockWebSocketInstances[0].simulateMessage({
          event_type: 'package_updated',
          package: { id: 123, status: 'in_transit' },
        })
      })

      expect(onPackageUpdate).toHaveBeenCalledWith({ id: 123, status: 'in_transit' })
    })

    it('updates lastMessage on any message', async () => {
      const { result } = renderHook(() => useWebSocket())

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        mockWebSocketInstances[0].simulateMessage({
          event_type: 'pong',
        })
      })

      expect(result.current.lastMessage).toEqual({ event_type: 'pong' })
    })
  })

  describe('Send Message', () => {
    it('sends message when connected', async () => {
      const { result } = renderHook(() => useWebSocket())

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.sendMessage({ action: 'test' })
      })

      expect(mockWebSocketInstances[0].send).toHaveBeenCalledWith(
        JSON.stringify({ action: 'test' })
      )
    })

    it('does not send when not connected', () => {
      Storage.prototype.getItem = jest.fn(() => null)

      const { result } = renderHook(() => useWebSocket())

      act(() => {
        result.current.sendMessage({ action: 'test' })
      })

      // No WebSocket should be created
      expect(mockWebSocketInstances.length).toBe(0)
    })
  })

  describe('Helper Methods', () => {
    it('markNotificationRead sends correct message', async () => {
      const { result } = renderHook(() => useWebSocket())

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.markNotificationRead(123)
      })

      expect(mockWebSocketInstances[0].send).toHaveBeenCalledWith(
        JSON.stringify({ action: 'mark_read', notification_id: 123 })
      )
    })

    it('requestUnreadCount sends correct message', async () => {
      const { result } = renderHook(() => useWebSocket())

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.requestUnreadCount()
      })

      expect(mockWebSocketInstances[0].send).toHaveBeenCalledWith(
        JSON.stringify({ action: 'get_unread_count' })
      )
    })
  })

  describe('Connection Status Callback', () => {
    it('calls onConnectionChange when status changes', async () => {
      const onConnectionChange = jest.fn()
      renderHook(() => useWebSocket({ onConnectionChange }))

      // Should be called with 'connecting' first
      expect(onConnectionChange).toHaveBeenCalledWith('connecting')

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(onConnectionChange).toHaveBeenCalledWith('connected')
      })
    })
  })

  describe('Error Handling', () => {
    it('updates status to error on WebSocket error', async () => {
      const onConnectionChange = jest.fn()
      const { result } = renderHook(() => useWebSocket({ onConnectionChange }))

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        mockWebSocketInstances[0].simulateError()
      })

      expect(onConnectionChange).toHaveBeenCalledWith('error')
    })
  })

  describe('Cleanup', () => {
    it('disconnects on unmount', async () => {
      const { result, unmount } = renderHook(() => useWebSocket())

      act(() => {
        jest.advanceTimersByTime(20)
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      unmount()

      // WebSocket should be closed
      expect(mockWebSocketInstances[0].readyState).toBe(MockWebSocket.CLOSED)
    })
  })
})
