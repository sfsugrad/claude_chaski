import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock the API functions
const mockGetCurrentUser = jest.fn()
const mockGetMyPendingRatings = jest.fn()

jest.mock('@/lib/api', () => ({
  authAPI: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
  ratingsAPI: {
    getMyPendingRatings: () => mockGetMyPendingRatings(),
  },
}))

// Mock Navbar
jest.mock('@/components/Navbar', () => {
  return function MockNavbar({ user }: { user: any }) {
    return <nav data-testid="navbar">Navbar for {user?.full_name}</nav>
  }
})

// Mock RatingModal
jest.mock('@/components/RatingModal', () => {
  return function MockRatingModal({
    isOpen,
    onClose,
    pendingRating,
  }: {
    isOpen: boolean
    onClose: () => void
    pendingRating: any
  }) {
    if (!isOpen) return null
    return (
      <div data-testid="rating-modal">
        Rating Modal for {pendingRating?.package_description}
        <button onClick={onClose}>Close</button>
      </div>
    )
  }
})

// Mock UI components
jest.mock('@/components/ui', () => ({
  Card: ({ children, className, hoverable }: any) => (
    <div className={`card ${className || ''} ${hoverable ? 'card-hover' : ''}`}>{children}</div>
  ),
  CardBody: ({ children, className }: any) => (
    <div className={`card-body ${className || ''}`}>{children}</div>
  ),
  CardHeader: ({ children, className }: any) => (
    <div className={`card-header ${className || ''}`}>{children}</div>
  ),
  Button: ({ children, variant, size, onClick, className, ...props }: any) => (
    <button onClick={onClick} className={className} {...props}>{children}</button>
  ),
  Badge: ({ children, variant, size, className }: any) => (
    <span className={`badge badge-${variant} badge-${size} ${className || ''}`}>{children}</span>
  ),
  Alert: ({ children, variant, className }: any) => (
    <div role="alert" className={`alert alert-${variant} ${className || ''}`}>{children}</div>
  ),
  DashboardSkeleton: () => (
    <div data-testid="dashboard-skeleton" className="animate-pulse">Loading skeleton...</div>
  ),
}))

describe('DashboardPage', () => {
  const mockRouter = {
    push: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    Storage.prototype.getItem = jest.fn()
    Storage.prototype.setItem = jest.fn()
    Storage.prototype.removeItem = jest.fn()
  })

  describe('Authentication', () => {
    it('redirects to login if API call fails', async () => {
      mockGetCurrentUser.mockRejectedValue(new Error('Unauthorized'))

      render(<DashboardPage />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
      })
    })

    it('shows dashboard when user is authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue({
        data: {
          id: 1,
          email: 'test@example.com',
          full_name: 'Test User',
          role: 'sender',
          is_active: true,
          is_verified: true,
          max_deviation_km: 5,
        },
      })
      mockGetMyPendingRatings.mockResolvedValue({ data: [] })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/welcome/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading state initially', () => {
      mockGetCurrentUser.mockImplementation(() => new Promise(() => {}))

      render(<DashboardPage />)

      // Check for skeleton loading state (uses animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('User Display', () => {
    const senderUser = {
      id: 1,
      email: 'sender@example.com',
      full_name: 'Sender User',
      role: 'sender',
      phone_number: '555-1234',
      is_active: true,
      is_verified: true,
      max_deviation_km: 5,
    }

    beforeEach(() => {
      ;(Storage.prototype.getItem as jest.Mock).mockReturnValue('fake-token')
      mockGetMyPendingRatings.mockResolvedValue({ data: [] })
    })

    it('displays user welcome message', async () => {
      mockGetCurrentUser.mockResolvedValue({ data: senderUser })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/welcome back, sender user/i)).toBeInTheDocument()
      })
    })

    it('displays user email', async () => {
      mockGetCurrentUser.mockResolvedValue({ data: senderUser })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('sender@example.com')).toBeInTheDocument()
      })
    })

    it('displays user role', async () => {
      mockGetCurrentUser.mockResolvedValue({ data: senderUser })

      render(<DashboardPage />)

      await waitFor(() => {
        // Role is displayed in a span with capitalize class
        const roleElements = screen.getAllByText(/sender/i)
        // At least one element should contain the role
        expect(roleElements.length).toBeGreaterThan(0)
      })
    })

    it('displays phone number', async () => {
      mockGetCurrentUser.mockResolvedValue({ data: senderUser })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('555-1234')).toBeInTheDocument()
      })
    })

    it('displays active status', async () => {
      mockGetCurrentUser.mockResolvedValue({ data: senderUser })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument()
      })
    })

    it('displays verified status', async () => {
      mockGetCurrentUser.mockResolvedValue({ data: senderUser })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Verified')).toBeInTheDocument()
      })
    })

    it('displays navbar', async () => {
      mockGetCurrentUser.mockResolvedValue({ data: senderUser })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('navbar')).toBeInTheDocument()
      })
    })
  })

  describe('Role-Based Content', () => {
    beforeEach(() => {
      ;(Storage.prototype.getItem as jest.Mock).mockReturnValue('fake-token')
      mockGetMyPendingRatings.mockResolvedValue({ data: [] })
    })

    it('shows sender actions for sender role', async () => {
      mockGetCurrentUser.mockResolvedValue({
        data: { id: 1, role: 'sender', full_name: 'Sender' },
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/my packages/i)).toBeInTheDocument()
        expect(screen.getByText(/send a package/i)).toBeInTheDocument()
      })
    })

    it('shows courier actions for courier role', async () => {
      mockGetCurrentUser.mockResolvedValue({
        data: { id: 1, role: 'courier', full_name: 'Courier', max_deviation_km: 5 },
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/find packages/i)).toBeInTheDocument()
      })
    })

    it('shows both sender and courier actions for both role', async () => {
      mockGetCurrentUser.mockResolvedValue({
        data: { id: 1, role: 'both', full_name: 'Both', max_deviation_km: 5 },
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/my packages/i)).toBeInTheDocument()
        expect(screen.getByText(/send a package/i)).toBeInTheDocument()
        expect(screen.getByText(/find packages/i)).toBeInTheDocument()
      })
    })

    it('shows max deviation for courier role', async () => {
      mockGetCurrentUser.mockResolvedValue({
        data: { id: 1, role: 'courier', full_name: 'Courier', max_deviation_km: 10 },
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('10 km')).toBeInTheDocument()
      })
    })
  })

  describe('Pending Ratings', () => {
    beforeEach(() => {
      ;(Storage.prototype.getItem as jest.Mock).mockReturnValue('fake-token')
      mockGetCurrentUser.mockResolvedValue({
        data: { id: 1, role: 'sender', full_name: 'User' },
      })
    })

    it('shows rating modal when pending ratings exist', async () => {
      mockGetMyPendingRatings.mockResolvedValue({
        data: [
          {
            package_id: 1,
            package_description: 'Test Package',
            user_to_rate_id: 2,
            user_to_rate_name: 'Courier',
            user_to_rate_role: 'courier',
          },
        ],
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('rating-modal')).toBeInTheDocument()
      })
    })

    it('does not show rating modal when no pending ratings', async () => {
      mockGetMyPendingRatings.mockResolvedValue({ data: [] })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('rating-modal')).not.toBeInTheDocument()
      })
    })

    it('shows pending ratings banner', async () => {
      mockGetMyPendingRatings.mockResolvedValue({
        data: [
          {
            package_id: 1,
            package_description: 'Test Package',
            user_to_rate_id: 2,
            user_to_rate_name: 'Courier',
            user_to_rate_role: 'courier',
          },
        ],
      })

      render(<DashboardPage />)

      // Close modal first
      await waitFor(() => {
        expect(screen.getByTestId('rating-modal')).toBeInTheDocument()
      })

      const closeButton = screen.getByText('Close')
      await userEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.getByText(/1 pending/i)).toBeInTheDocument()
      })
    })
  })
})
