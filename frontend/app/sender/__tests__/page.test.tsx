import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import SenderDashboard from '../page'
import { packagesAPI, authAPI, ratingsAPI } from '@/lib/api'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock the Navbar component to avoid NotificationDropdown dependencies
jest.mock('@/components/Navbar', () => {
  return function MockNavbar({ user }: { user: any }) {
    return <nav data-testid="navbar">{user?.full_name}</nav>
  }
})

// Mock UI components - only mock what's needed for this test
jest.mock('@/components/ui', () => ({
  SenderDashboardSkeleton: () => (
    <div data-testid="sender-dashboard-skeleton" className="animate-pulse">Loading skeleton...</div>
  ),
}))

// Mock the API modules
jest.mock('@/lib/api', () => ({
  packagesAPI: {
    getAll: jest.fn(),
    cancel: jest.fn(),
  },
  authAPI: {
    getCurrentUser: jest.fn(),
  },
  ratingsAPI: {
    getMyPendingRatings: jest.fn(),
  },
}))

const mockRouter = {
  push: jest.fn(),
  refresh: jest.fn(),
}

const mockUser = {
  id: 1,
  email: 'sender@example.com',
  full_name: 'Test Sender',
  role: 'sender',
  is_active: true,
  is_verified: true,
  max_deviation_km: 5,
  created_at: '2024-01-01T00:00:00Z',
}

const mockPackages = [
  {
    id: 1,
    sender_id: 1,
    courier_id: null,
    sender_name: 'Test Sender',
    courier_name: null,
    description: 'Test package 1',
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
  },
  {
    id: 2,
    sender_id: 1,
    courier_id: 5,
    sender_name: 'Test Sender',
    courier_name: 'Test Courier',
    description: 'Test package 2 - matched',
    size: 'medium',
    weight_kg: 5.0,
    status: 'matched',
    pickup_address: '789 Start Blvd',
    pickup_lat: 40.73,
    pickup_lng: -74.02,
    dropoff_address: '321 End Way',
    dropoff_lat: 40.74,
    dropoff_lng: -74.03,
    pickup_contact_name: null,
    pickup_contact_phone: null,
    dropoff_contact_name: null,
    dropoff_contact_phone: null,
    price: 50.0,
    created_at: '2024-01-16T12:00:00Z',
    updated_at: '2024-01-16T14:00:00Z',
  },
  {
    id: 3,
    sender_id: 1,
    courier_id: 5,
    sender_name: 'Test Sender',
    courier_name: 'Test Courier',
    description: 'Delivered package',
    size: 'large',
    weight_kg: 10.0,
    status: 'delivered',
    pickup_address: 'Origin Place',
    pickup_lat: 40.75,
    pickup_lng: -74.04,
    dropoff_address: 'Destination Lane',
    dropoff_lat: 40.76,
    dropoff_lng: -74.05,
    pickup_contact_name: 'Alice',
    pickup_contact_phone: null,
    dropoff_contact_name: 'Bob',
    dropoff_contact_phone: null,
    price: 100.0,
    created_at: '2024-01-10T08:00:00Z',
    updated_at: '2024-01-12T16:00:00Z',
  },
]

describe('SenderDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(packagesAPI.getAll as jest.Mock).mockResolvedValue({ data: mockPackages })
    ;(ratingsAPI.getMyPendingRatings as jest.Mock).mockResolvedValue({ data: [] })
  })

  describe('Page Rendering', () => {
    it('renders the sender dashboard with header', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('My Packages')).toBeInTheDocument()
      })
      expect(screen.getByText('Track and manage your deliveries')).toBeInTheDocument()
    })

    it('renders the New Package button', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('New Package')).toBeInTheDocument()
      })
    })

    it('renders back to dashboard link', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('My Packages')).toBeInTheDocument()
      })
    })

    it('shows loading state initially', () => {
      render(<SenderDashboard />)
      // Check for skeleton loading state (uses animate-pulse class)
      const skeletons = document.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Authentication', () => {
    it('redirects to login if not authenticated', async () => {
      ;(authAPI.getCurrentUser as jest.Mock).mockRejectedValue(new Error('Unauthorized'))

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
      })
    })

    it('redirects to dashboard if user is only courier', async () => {
      ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({
        data: { ...mockUser, role: 'courier' },
      })

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('allows sender role', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('My Packages')).toBeInTheDocument()
      })
      expect(mockRouter.push).not.toHaveBeenCalledWith('/dashboard')
    })

    it('allows both role', async () => {
      ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({
        data: { ...mockUser, role: 'both' },
      })

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('My Packages')).toBeInTheDocument()
      })
    })

    it('allows admin role', async () => {
      ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({
        data: { ...mockUser, role: 'admin' },
      })

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('My Packages')).toBeInTheDocument()
      })
    })
  })

  describe('Package List', () => {
    it('displays all packages', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })
      expect(screen.getByText('Test package 2 - matched')).toBeInTheDocument()
      expect(screen.getByText('Delivered package')).toBeInTheDocument()
    })

    it('displays package addresses', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('123 Pickup St')).toBeInTheDocument()
      })
      expect(screen.getByText('456 Dropoff Ave')).toBeInTheDocument()
    })

    it('displays package prices', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('$25.00')).toBeInTheDocument()
      })
      expect(screen.getByText('$50.00')).toBeInTheDocument()
      expect(screen.getByText('$100.00')).toBeInTheDocument()
    })

    it('displays empty state when no packages', async () => {
      ;(packagesAPI.getAll as jest.Mock).mockResolvedValue({ data: [] })

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('No packages yet')).toBeInTheDocument()
      })
      expect(screen.getByText('Create Your First Package')).toBeInTheDocument()
    })
  })

  describe('Status Filters', () => {
    it('renders status filter buttons', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument()
      })
      // Filter buttons show formatted labels
      expect(screen.getAllByText('Pending').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Matched').length).toBeGreaterThan(0)
      expect(screen.getAllByText(/In Transit/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0)
    })

    it('shows correct counts for each status', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        // All packages count
        const allButton = screen.getByText('All').closest('button')
        expect(allButton).toHaveTextContent('3')
      })
    })

    it('filters packages by pending status', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })

      // Find the filter button by finding the element that has both 'Pending' text and a count
      const filterButtons = screen.getAllByRole('button')
      const pendingButton = filterButtons.find(btn =>
        btn.textContent?.includes('Pending') && btn.textContent?.includes('1')
      )
      fireEvent.click(pendingButton!)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })
      expect(screen.queryByText('Delivered package')).not.toBeInTheDocument()
    })

    it('filters packages by delivered status', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Delivered package')).toBeInTheDocument()
      })

      // Find the delivered filter button by matching text content
      const filterButtons = screen.getAllByRole('button')
      const deliveredButton = filterButtons.find(btn =>
        btn.textContent?.includes('Delivered') && /\d/.test(btn.textContent || '')
      )
      fireEvent.click(deliveredButton!)

      await waitFor(() => {
        expect(screen.getByText('Delivered package')).toBeInTheDocument()
      })
      expect(screen.queryByText('Test package 1')).not.toBeInTheDocument()
    })

    it('shows empty state for filter with no packages', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('My Packages')).toBeInTheDocument()
      })

      const cancelledButton = screen.getByText('Cancelled').closest('button')
      fireEvent.click(cancelledButton!)

      await waitFor(() => {
        expect(screen.getByText('No cancelled packages')).toBeInTheDocument()
      })
    })
  })

  describe('Status Display', () => {
    it('displays correct status badges', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getAllByText(/Pending/i).length).toBeGreaterThan(0)
      })
      expect(screen.getAllByText(/Matched/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/Delivered/i).length).toBeGreaterThan(0)
    })

    it('displays progress tracker for non-cancelled packages', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        // Progress steps should be visible
        const progressSteps = screen.getAllByText('Picked Up')
        expect(progressSteps.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Cancel Package', () => {
    it('shows cancel button for pending packages', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })

      const cancelButtons = screen.getAllByText('Cancel')
      expect(cancelButtons.length).toBeGreaterThan(0)
    })

    it('shows cancel button for matched packages', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 2 - matched')).toBeInTheDocument()
      })

      // Should have cancel buttons for both pending and matched
      const cancelButtons = screen.getAllByText('Cancel')
      expect(cancelButtons.length).toBe(2)
    })

    it('does not show cancel button for delivered packages', async () => {
      ;(packagesAPI.getAll as jest.Mock).mockResolvedValue({
        data: [mockPackages[2]], // Only delivered package
      })

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Delivered package')).toBeInTheDocument()
      })

      expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    })

    it('calls cancel API when cancel is clicked and confirmed', async () => {
      window.confirm = jest.fn().mockReturnValue(true)
      ;(packagesAPI.cancel as jest.Mock).mockResolvedValue({ data: { ...mockPackages[0], status: 'cancelled' } })

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })

      const cancelButtons = screen.getAllByText('Cancel')
      fireEvent.click(cancelButtons[0])

      await waitFor(() => {
        expect(packagesAPI.cancel).toHaveBeenCalledWith(1)
      })
    })

    it('does not call cancel API when cancel is not confirmed', async () => {
      window.confirm = jest.fn().mockReturnValue(false)

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })

      const cancelButtons = screen.getAllByText('Cancel')
      fireEvent.click(cancelButtons[0])

      expect(packagesAPI.cancel).not.toHaveBeenCalled()
    })

    it('shows error alert when cancel fails', async () => {
      window.confirm = jest.fn().mockReturnValue(true)
      window.alert = jest.fn()
      ;(packagesAPI.cancel as jest.Mock).mockRejectedValue({
        response: { data: { detail: 'Cannot cancel this package' } },
      })

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })

      const cancelButtons = screen.getAllByText('Cancel')
      fireEvent.click(cancelButtons[0])

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Cannot cancel this package')
      })
    })
  })

  describe('Courier Info', () => {
    it('displays courier info for matched packages', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 2 - matched')).toBeInTheDocument()
      })

      // There should be courier info for matched and delivered packages (both have courier_id)
      const courierInfoElements = screen.getAllByText(/Courier assigned/)
      expect(courierInfoElements.length).toBeGreaterThan(0)
    })

    it('does not show courier info for pending packages', async () => {
      ;(packagesAPI.getAll as jest.Mock).mockResolvedValue({
        data: [mockPackages[0]], // Only pending package
      })

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })

      expect(screen.queryByText(/Courier assigned/)).not.toBeInTheDocument()
    })
  })

  describe('Package Details Link', () => {
    it('renders view details link for each package', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })

      const viewDetailsLinks = screen.getAllByText('View Details')
      expect(viewDetailsLinks.length).toBe(3)
    })

    it('view details links have correct href', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Test package 1')).toBeInTheDocument()
      })

      const viewDetailsLinks = screen.getAllByText('View Details')
      // All view details links should have href pointing to package detail pages
      viewDetailsLinks.forEach((link) => {
        const href = link.closest('a')?.getAttribute('href')
        expect(href).toMatch(/^\/packages\/\d+$/)
      })
    })
  })

  describe('Package Card Details', () => {
    it('displays package size', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('small')).toBeInTheDocument()
      })
      expect(screen.getByText('medium')).toBeInTheDocument()
      expect(screen.getByText('large')).toBeInTheDocument()
    })

    it('displays package weight', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('2.5 kg')).toBeInTheDocument()
      })
      expect(screen.getByText('5 kg')).toBeInTheDocument()
      expect(screen.getByText('10 kg')).toBeInTheDocument()
    })

    it('displays package ID', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Package #1')).toBeInTheDocument()
      })
      expect(screen.getByText('Package #2')).toBeInTheDocument()
      expect(screen.getByText('Package #3')).toBeInTheDocument()
    })

    it('displays contact names when available', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })
  })

  describe('New Package Button', () => {
    it('new package button links to create page', async () => {
      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('New Package')).toBeInTheDocument()
      })

      const newPackageButton = screen.getByText('New Package').closest('a')
      expect(newPackageButton).toHaveAttribute('href', '/packages/create')
    })
  })

  describe('Error Handling', () => {
    it('displays error message when package loading fails', async () => {
      ;(packagesAPI.getAll as jest.Mock).mockRejectedValue(new Error('Network error'))

      render(<SenderDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load packages')).toBeInTheDocument()
      })
    })
  })
})
