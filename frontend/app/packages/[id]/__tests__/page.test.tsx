import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useParams, useRouter } from 'next/navigation'
import PackageDetailPage from '../page'
import axios, { matchingAPI, ratingsAPI, messagesAPI } from '@/lib/api'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}))

// Mock the Navbar component
jest.mock('@/components/Navbar', () => {
  return function MockNavbar({ user }: { user: any }) {
    return <nav data-testid="navbar">{user?.full_name}</nav>
  }
})

// Mock the ChatWindow component
jest.mock('@/components/ChatWindow', () => {
  return function MockChatWindow() {
    return <div data-testid="chat-window">Chat Window</div>
  }
})

// Mock the RatingModal component
jest.mock('@/components/RatingModal', () => {
  return function MockRatingModal() {
    return <div data-testid="rating-modal">Rating Modal</div>
  }
})

// Mock useWebSocket hook
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    connectionStatus: 'connected',
    isConnected: true,
    sendMessage: jest.fn(),
  }),
}))

// Mock the API modules
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
  },
  matchingAPI: {
    acceptPackage: jest.fn(),
  },
  ratingsAPI: {
    getPackageRatings: jest.fn(),
  },
  messagesAPI: {
    getPackageMessages: jest.fn(),
    getConversations: jest.fn(),
  },
}))

const mockRouter = {
  push: jest.fn(),
  refresh: jest.fn(),
}

const mockSender = {
  id: 1,
  email: 'sender@example.com',
  full_name: 'Test Sender',
  role: 'sender',
  is_active: true,
  is_verified: true,
  max_deviation_km: 5,
  created_at: '2024-01-01T00:00:00Z',
}

const mockCourier = {
  id: 2,
  email: 'courier@example.com',
  full_name: 'Test Courier',
  role: 'courier',
  is_active: true,
  is_verified: true,
  max_deviation_km: 10,
  created_at: '2024-01-01T00:00:00Z',
}

const mockBothUser = {
  id: 3,
  email: 'both@example.com',
  full_name: 'Both Role User',
  role: 'both',
  is_active: true,
  is_verified: true,
  max_deviation_km: 10,
  created_at: '2024-01-01T00:00:00Z',
}

const mockPendingPackage = {
  id: 123,
  sender_id: 1,
  courier_id: null,
  description: 'Test pending package',
  size: 'small',
  weight_kg: 2.5,
  status: 'pending',
  pickup_address: '123 Pickup St',
  pickup_lat: 40.7128,
  pickup_lng: -74.006,
  dropoff_address: '456 Dropoff Ave',
  dropoff_lat: 40.72,
  dropoff_lng: -74.01,
  pickup_contact_name: 'John Doe',
  pickup_contact_phone: '+1234567890',
  dropoff_contact_name: 'Jane Smith',
  dropoff_contact_phone: '+0987654321',
  price: 25.0,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: null,
  sender_name: 'Test Sender',
  courier_name: null,
}

const mockAcceptedPackage = {
  ...mockPendingPackage,
  id: 124,
  status: 'matched',
  courier_id: 2,
  courier_name: 'Test Courier',
}

// Helper to set up mocks for a test
const setupMocks = (user: any, packageData: any) => {
  // Mock localStorage
  Storage.prototype.getItem = jest.fn(() => 'fake-token')

  // Mock axios.get to return different data based on URL
  ;(axios.get as jest.Mock).mockImplementation((url: string) => {
    if (url === '/auth/me') {
      return Promise.resolve({ data: user })
    }
    if (url.startsWith('/packages/')) {
      return Promise.resolve({ data: packageData })
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`))
  })

  // Mock messagesAPI
  ;(messagesAPI.getPackageMessages as jest.Mock).mockResolvedValue({ data: [] })
  ;(messagesAPI.getConversations as jest.Mock).mockResolvedValue({
    data: { conversations: [] },
  })

  // Mock ratingsAPI
  ;(ratingsAPI.getPackageRatings as jest.Mock).mockResolvedValue({ data: [] })
}

describe('PackageDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useParams as jest.Mock).mockReturnValue({ id: '123' })
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
  })

  describe('Accept Package Button Visibility', () => {
    it('shows Accept Package button for courier viewing pending package', async () => {
      setupMocks(mockCourier, mockPendingPackage)

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept Package')).toBeInTheDocument()
      })
    })

    it('shows Accept Package button for both-role user viewing pending package', async () => {
      setupMocks(mockBothUser, mockPendingPackage)

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept Package')).toBeInTheDocument()
      })
    })

    it('does NOT show Accept Package button for sender viewing their own pending package', async () => {
      setupMocks(mockSender, mockPendingPackage)

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Test pending package')).toBeInTheDocument()
      })

      // Sender should NOT see Accept button (they own the package)
      expect(screen.queryByText('Accept Package')).not.toBeInTheDocument()
    })

    it('does NOT show Accept Package button for accepted packages', async () => {
      setupMocks(mockCourier, mockAcceptedPackage)

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Test pending package')).toBeInTheDocument()
      })

      // Should not show Accept button for non-pending packages
      expect(screen.queryByText('Accept Package')).not.toBeInTheDocument()
    })

    it('does NOT show Accept Package button for sender role', async () => {
      const senderOnlyUser = { ...mockSender, id: 99 } // Different ID than package sender
      setupMocks(senderOnlyUser, mockPendingPackage)

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Test pending package')).toBeInTheDocument()
      })

      // Sender-only users cannot accept packages
      expect(screen.queryByText('Accept Package')).not.toBeInTheDocument()
    })
  })

  describe('Accept Package Functionality', () => {
    it('calls acceptPackage API when Accept Package is clicked', async () => {
      setupMocks(mockCourier, mockPendingPackage)
      ;(matchingAPI.acceptPackage as jest.Mock).mockResolvedValue({
        data: { ...mockPendingPackage, status: 'matched', courier_id: 2 },
      })
      window.alert = jest.fn()

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept Package')).toBeInTheDocument()
      })

      const acceptButton = screen.getByText('Accept Package')
      fireEvent.click(acceptButton)

      await waitFor(() => {
        expect(matchingAPI.acceptPackage).toHaveBeenCalledWith(123)
      })
    })

    it('shows success alert after accepting package', async () => {
      setupMocks(mockCourier, mockPendingPackage)
      ;(matchingAPI.acceptPackage as jest.Mock).mockResolvedValue({
        data: { ...mockPendingPackage, status: 'matched', courier_id: 2 },
      })
      window.alert = jest.fn()

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept Package')).toBeInTheDocument()
      })

      const acceptButton = screen.getByText('Accept Package')
      fireEvent.click(acceptButton)

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Package accepted successfully!')
      })
    })

    it('shows error alert when accepting fails', async () => {
      setupMocks(mockCourier, mockPendingPackage)
      ;(matchingAPI.acceptPackage as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Package already accepted' } },
      })
      window.alert = jest.fn()

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept Package')).toBeInTheDocument()
      })

      const acceptButton = screen.getByText('Accept Package')
      fireEvent.click(acceptButton)

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Package already accepted')
      })
    })

    it('shows loading state while accepting', async () => {
      setupMocks(mockCourier, mockPendingPackage)
      // Never resolve to keep loading state
      ;(matchingAPI.acceptPackage as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      )

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept Package')).toBeInTheDocument()
      })

      const acceptButton = screen.getByText('Accept Package')
      fireEvent.click(acceptButton)

      await waitFor(() => {
        expect(screen.getByText('Accepting...')).toBeInTheDocument()
      })
    })

    it('disables button while accepting', async () => {
      setupMocks(mockCourier, mockPendingPackage)
      ;(matchingAPI.acceptPackage as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      )

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Accept Package')).toBeInTheDocument()
      })

      const acceptButton = screen.getByText('Accept Package')
      fireEvent.click(acceptButton)

      await waitFor(() => {
        expect(screen.getByText('Accepting...')).toBeDisabled()
      })
    })
  })

  describe('Package Names Display', () => {
    it('displays sender_name in package details', async () => {
      setupMocks(mockSender, mockPendingPackage)

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Sender')).toBeInTheDocument()
      })
    })

    it('displays courier_name when package is assigned', async () => {
      setupMocks(mockSender, mockAcceptedPackage)

      render(<PackageDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Courier')).toBeInTheDocument()
      })
    })
  })
})
