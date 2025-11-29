import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import Navbar from '../Navbar'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/dashboard'),
}))

// Mock NotificationDropdown
jest.mock('../NotificationDropdown', () => {
  return function MockNotificationDropdown() {
    return <div data-testid="notification-dropdown">Notifications</div>
  }
})

// Mock StarRating
jest.mock('../StarRating', () => {
  return function MockStarRating({ rating }: { rating: number }) {
    return <span data-testid="star-rating">★ {rating}</span>
  }
})

// Mock UI components
jest.mock('@/components/ui', () => ({
  Badge: ({ children, variant, size, dot }: any) => (
    <span data-testid="badge" className={`badge badge-${variant} badge-${size}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  ),
  ConnectionStatus: ({ status }: { status: string }) => (
    <div data-testid="connection-status" data-status={status} />
  ),
}))

// Mock WebSocketContext
jest.mock('@/contexts/WebSocketContext', () => ({
  useWebSocketContext: () => ({
    unreadCount: 0,
    setUnreadCount: jest.fn(),
    onMessageReceived: jest.fn(() => () => {}), // Returns an unsubscribe function
    connectionStatus: 'connected',
  }),
}))

// Mock the API calls
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: { count: 0 } })),
  },
  messagesAPI: {
    getUnreadCount: jest.fn(() => Promise.resolve({ data: { unread_count: 0 } })),
  },
  authAPI: {
    logout: jest.fn(() => Promise.resolve({ data: { message: 'Logged out' } })),
  },
}))

const mockUser = {
  id: 1,
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'sender',
  phone_number: null,
  is_active: true,
  is_verified: true,
  max_deviation_km: 5,
  default_address: null,
  default_address_lat: null,
  default_address_lng: null,
  created_at: '2024-01-01T00:00:00Z',
  average_rating: 4.5,
  total_ratings: 10,
}

describe('Navbar', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      },
      writable: true,
    })
  })

  describe('Rating display', () => {
    it('displays user rating when available', () => {
      render(<Navbar user={mockUser} />)

      const starRatings = screen.getAllByTestId('star-rating')
      expect(starRatings.length).toBeGreaterThan(0)
      expect(screen.getByText('(10)')).toBeInTheDocument()
    })

    it('displays zero rating when user has no ratings', () => {
      const userWithNoRatings = {
        ...mockUser,
        average_rating: null,
        total_ratings: 0,
      }

      render(<Navbar user={userWithNoRatings} />)

      expect(screen.getByText('(0)')).toBeInTheDocument()
    })

    it('rating links to reviews page when mobile menu is open', () => {
      render(<Navbar user={mockUser} />)

      // Open mobile menu to access the reviews link
      const menuButton = screen.getByLabelText('Toggle menu')
      fireEvent.click(menuButton)

      // Find links that go to /profile/reviews in mobile menu
      const allLinks = screen.getAllByRole('link')
      const reviewLinks = allLinks.filter(link => link.getAttribute('href') === '/profile/reviews')

      expect(reviewLinks.length).toBeGreaterThan(0)
      reviewLinks.forEach(link => {
        expect(link).toHaveAttribute('href', '/profile/reviews')
      })
    })
  })

  describe('User display', () => {
    it('displays user full name', () => {
      render(<Navbar user={mockUser} />)

      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    it('shows login/signup when no user', () => {
      render(<Navbar user={null} />)

      expect(screen.getByText('Login')).toBeInTheDocument()
      expect(screen.getByText('Sign Up')).toBeInTheDocument()
    })
  })

  describe('Navigation links', () => {
    it('shows sender links for sender role', () => {
      render(<Navbar user={mockUser} />)

      expect(screen.getByText('My Packages')).toBeInTheDocument()
      expect(screen.getByText('Send Package')).toBeInTheDocument()
    })

    it('shows courier link for courier role', () => {
      const courierUser = { ...mockUser, role: 'courier' }
      render(<Navbar user={courierUser} />)

      expect(screen.getByText('Courier')).toBeInTheDocument()
    })

    it('shows admin link for admin role', () => {
      const adminUser = { ...mockUser, role: 'admin' }
      render(<Navbar user={adminUser} />)

      expect(screen.getByText('Admin')).toBeInTheDocument()
    })

    it('shows both sender and courier links for both role', () => {
      const bothUser = { ...mockUser, role: 'both' }
      render(<Navbar user={bothUser} />)

      expect(screen.getByText('My Packages')).toBeInTheDocument()
      expect(screen.getByText('Send Package')).toBeInTheDocument()
      expect(screen.getByText('Courier')).toBeInTheDocument()
    })
  })

  describe('Logout', () => {
    it('calls logout API and redirects on logout', async () => {
      const { authAPI } = require('@/lib/api')
      render(<Navbar user={mockUser} />)

      // Open mobile menu to access the logout button
      const menuButton = screen.getByLabelText('Toggle menu')
      fireEvent.click(menuButton)

      const logoutButton = screen.getByText('Logout')
      fireEvent.click(logoutButton)

      expect(authAPI.logout).toHaveBeenCalled()
      // Wait for async logout to complete
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })

  describe('Mobile menu', () => {
    it('toggles mobile menu on button click', () => {
      render(<Navbar user={mockUser} />)

      const menuButton = screen.getByLabelText('Toggle menu')

      // Menu should be hidden initially - check for mobile-specific content
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument()

      // Click to open menu
      fireEvent.click(menuButton)

      // Email appears in mobile menu
      expect(screen.getByText('test@example.com')).toBeInTheDocument()

      // Click to close menu
      fireEvent.click(menuButton)

      // Email should be hidden again
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument()
    })

    it('shows rating in mobile menu', () => {
      render(<Navbar user={mockUser} />)

      const menuButton = screen.getByLabelText('Toggle menu')
      fireEvent.click(menuButton)

      // Should show rating count in mobile menu as well
      const ratingCounts = screen.getAllByText('(10)')
      expect(ratingCounts.length).toBeGreaterThanOrEqual(1)
    })

    it('closes mobile menu when clicking review link', () => {
      render(<Navbar user={mockUser} />)

      const menuButton = screen.getByLabelText('Toggle menu')
      fireEvent.click(menuButton)

      // Get the mobile menu rating link (second one)
      const ratingLinks = screen.getAllByRole('link', { name: /★/i })
      const mobileRatingLink = ratingLinks[ratingLinks.length - 1]

      fireEvent.click(mobileRatingLink)

      // Menu should close (email hidden)
      expect(screen.queryByText('test@example.com')).not.toBeInTheDocument()
    })
  })

  describe('Notification dropdown', () => {
    it('renders notification dropdown for logged in users', () => {
      render(<Navbar user={mockUser} />)

      expect(screen.getByTestId('notification-dropdown')).toBeInTheDocument()
    })

    it('does not render notification dropdown for guests', () => {
      render(<Navbar user={null} />)

      expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument()
    })
  })

  describe('Logo', () => {
    it('renders Chaski logo linking to dashboard', () => {
      render(<Navbar user={mockUser} />)

      const logo = screen.getByText('Chaski')
      expect(logo).toBeInTheDocument()
      // The logo text is in a span, but its parent link goes to dashboard
      const logoLink = logo.closest('a')
      expect(logoLink).toHaveAttribute('href', '/dashboard')
    })
  })
})
