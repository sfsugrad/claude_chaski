import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import CourierPage from '../page'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock the API functions
const mockGetCurrentUser = jest.fn()
const mockGetMyRoutes = jest.fn()
const mockGetMyPendingRatings = jest.fn()
const mockGetAllPackages = jest.fn()

jest.mock('@/lib/api', () => ({
  authAPI: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
  couriersAPI: {
    getMyRoutes: () => mockGetMyRoutes(),
    getRoutes: () => mockGetMyRoutes(),
  },
  ratingsAPI: {
    getMyPendingRatings: () => mockGetMyPendingRatings(),
  },
  packagesAPI: {
    getAll: () => mockGetAllPackages(),
  },
}))

// Mock RatingModal
jest.mock('@/components/RatingModal', () => {
  return function MockRatingModal() {
    return null
  }
})

// Mock Navbar
jest.mock('@/components/Navbar', () => {
  return function MockNavbar() {
    return <nav data-testid="navbar">Mock Navbar</nav>
  }
})

// Mock UI components
jest.mock('@/components/ui', () => ({
  CourierDashboardSkeleton: () => (
    <div data-testid="courier-dashboard-skeleton" className="animate-pulse">Loading skeleton...</div>
  ),
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardBody: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardHeader: ({ title, subtitle }: any) => <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>,
  Button: ({ children, onClick, disabled, className, variant, size, leftIcon }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>{leftIcon}{children}</button>
  ),
  Badge: ({ children, variant, size }: any) => <span className={`badge-${variant}`}>{children}</span>,
  Alert: ({ children, variant, className }: any) => <div role="alert" className={`alert-${variant} ${className || ''}`}>{children}</div>,
  EmptyRoutes: ({ title, description, action }: any) => (
    <div data-testid="empty-routes">
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  ),
  FadeIn: ({ children }: any) => <div>{children}</div>,
  SlideIn: ({ children }: any) => <div>{children}</div>,
}))

describe('CourierPage', () => {
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
    it('redirects to home if user is not a courier', async () => {
      // Mock auth API to return a sender user (role check succeeds but role doesn't match)
      mockGetCurrentUser.mockResolvedValue({
        data: {
          id: 1,
          email: 'sender@example.com',
          full_name: 'Sender User',
          role: 'sender',
        },
      })

      render(<CourierPage />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/')
      })
    })

    it('shows loading state initially', () => {
      // Mock a pending request
      mockGetCurrentUser.mockImplementation(() => new Promise(() => {}))

      render(<CourierPage />)

      // Check for skeleton loading state (uses animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders dashboard for courier users', async () => {
      // Mock auth API to return a courier user
      mockGetCurrentUser.mockResolvedValue({
        data: {
          id: 1,
          email: 'courier@example.com',
          full_name: 'Courier User',
          role: 'courier',
        },
      })
      mockGetMyRoutes.mockResolvedValue({ data: [] })
      mockGetMyPendingRatings.mockResolvedValue({ data: [] })

      render(<CourierPage />)

      await waitFor(() => {
        expect(screen.getByText('Courier Dashboard')).toBeInTheDocument()
      })
    })

    it('renders dashboard for users with both role', async () => {
      // Mock auth API to return a user with both role
      mockGetCurrentUser.mockResolvedValue({
        data: {
          id: 1,
          email: 'both@example.com',
          full_name: 'Both User',
          role: 'both',
        },
      })
      mockGetMyRoutes.mockResolvedValue({ data: [] })
      mockGetMyPendingRatings.mockResolvedValue({ data: [] })

      render(<CourierPage />)

      await waitFor(() => {
        expect(screen.getByText('Courier Dashboard')).toBeInTheDocument()
      })
    })
  })

  describe('Page Content', () => {
    beforeEach(() => {
      // Setup default successful auth for courier
      mockGetCurrentUser.mockResolvedValue({
        data: {
          id: 1,
          email: 'courier@example.com',
          full_name: 'Courier User',
          role: 'courier',
        },
      })
      mockGetMyRoutes.mockResolvedValue({ data: [] })
      mockGetMyPendingRatings.mockResolvedValue({ data: [] })
      mockGetAllPackages.mockResolvedValue({ data: [] })
    })

    it('renders navbar', async () => {
      render(<CourierPage />)

      await waitFor(() => {
        expect(screen.getByTestId('navbar')).toBeInTheDocument()
      })
    })

    it('shows message when no routes exist', async () => {
      render(<CourierPage />)

      await waitFor(() => {
        expect(screen.getByText(/Welcome to Chaski/)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message when API fails', async () => {
      mockGetCurrentUser.mockRejectedValue(new Error('API Error'))

      render(<CourierPage />)

      await waitFor(() => {
        expect(screen.getByText(/Failed to load data/)).toBeInTheDocument()
      })
    })

    it('redirects to login when API fails', async () => {
      mockGetCurrentUser.mockRejectedValue(new Error('API Error'))

      render(<CourierPage />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
      })
    })
  })
})
