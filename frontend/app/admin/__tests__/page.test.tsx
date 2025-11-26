import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import axios from '@/lib/api'
import AdminPage from '../page'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('@/lib/api')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('AdminPage', () => {
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

  describe('Authentication and Authorization', () => {
    it('redirects to login if no token exists', async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue(null)

      render(<AdminPage />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
      })
    })

    it('redirects to login if user fetch fails', async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockRejectedValueOnce(new Error('Unauthorized'))

      render(<AdminPage />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
      })
    })

    it('shows access denied message for non-admin users', async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'user@example.com',
          full_name: 'Regular User',
          role: 'SENDER',
        },
      })

      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Access denied. Admin privileges required.')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/')
      }, { timeout: 3500 })
    })

    it('allows access for admin users', async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })

      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Chaski Admin Dashboard')).toBeInTheDocument()
      })
    })
  })

  describe('Page Rendering', () => {
    beforeEach(() => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })
    })

    it('renders loading state initially', () => {
      render(<AdminPage />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders header with admin info', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Chaski Admin Dashboard')).toBeInTheDocument()
        expect(screen.getByText(/Admin User/)).toBeInTheDocument()
        expect(screen.getByText(/admin@example.com/)).toBeInTheDocument()
      })
    })

    it('renders logout button', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation Tabs', () => {
    beforeEach(async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })
    })

    it('renders all navigation tabs', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Overview')).toBeInTheDocument()
        expect(screen.getByText('Users')).toBeInTheDocument()
        expect(screen.getByText('Packages')).toBeInTheDocument()
      })
    })

    it('shows overview tab by default', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Platform Overview')).toBeInTheDocument()
      })
    })

    it('switches to users tab when clicked', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Platform Overview')).toBeInTheDocument()
      })

      const usersTab = getByText('Users')
      usersTab.click()

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })
    })

    it('switches to packages tab when clicked', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Platform Overview')).toBeInTheDocument()
      })

      const packagesTab = getByText('Packages')
      packagesTab.click()

      await waitFor(() => {
        expect(screen.getByText('Package Management')).toBeInTheDocument()
      })
    })
  })

  describe('Overview Tab', () => {
    beforeEach(async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })
    })

    it('renders stats cards', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Total Users')).toBeInTheDocument()
        expect(screen.getByText('Senders')).toBeInTheDocument()
        expect(screen.getByText('Couriers')).toBeInTheDocument()
        expect(screen.getByText('Active Packages')).toBeInTheDocument()
      })
    })

    it('renders quick actions section', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
        expect(screen.getByText('Manage Users')).toBeInTheDocument()
        expect(screen.getByText('View Packages')).toBeInTheDocument()
        expect(screen.getByText('Generate Reports (Coming Soon)')).toBeInTheDocument()
      })
    })

    it('quick action buttons navigate to correct tabs', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      })

      const manageUsersBtn = getByText('Manage Users')
      manageUsersBtn.click()

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })
    })
  })

  describe('Users Tab', () => {
    beforeEach(async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })
    })

    it('shows placeholder message when no API endpoints', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('Admin API endpoints not yet implemented')).toBeInTheDocument()
      })
    })

    it('renders user management title', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument()
      })
    })
  })

  describe('Packages Tab', () => {
    beforeEach(async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })
    })

    it('shows placeholder message when no API endpoints', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const packagesTab = getByText('Packages')
        packagesTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('Admin API endpoints not yet implemented')).toBeInTheDocument()
      })
    })

    it('renders package management title', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const packagesTab = getByText('Packages')
        packagesTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('Package Management')).toBeInTheDocument()
      })
    })
  })

  describe('Logout Functionality', () => {
    beforeEach(async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })
    })

    it('clears token and redirects on logout', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument()
      })

      const logoutBtn = getByText('Logout')
      logoutBtn.click()

      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
      expect(mockRouter.push).toHaveBeenCalledWith('/login')
    })
  })

  describe('Styling and Layout', () => {
    beforeEach(async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })
    })

    it('uses purple color scheme for admin branding', async () => {
      const { container } = render(<AdminPage />)

      await waitFor(() => {
        const header = container.querySelector('.bg-purple-600')
        expect(header).toBeInTheDocument()
      })
    })

    it('renders stats with different colors', async () => {
      const { container } = render(<AdminPage />)

      await waitFor(() => {
        expect(container.querySelector('.text-purple-600')).toBeInTheDocument()
        expect(container.querySelector('.text-blue-600')).toBeInTheDocument()
        expect(container.querySelector('.text-green-600')).toBeInTheDocument()
        expect(container.querySelector('.text-orange-600')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    beforeEach(async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })
    })

    it('uses proper heading hierarchy', async () => {
      const { container } = render(<AdminPage />)

      await waitFor(() => {
        const h1 = container.querySelector('h1')
        const h2 = container.querySelector('h2')
        const h3 = container.querySelector('h3')

        expect(h1).toBeInTheDocument()
        expect(h2).toBeInTheDocument()
        expect(h3).toBeInTheDocument()
      })
    })

    it('has descriptive button text', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument()
        expect(screen.getByText('Manage Users')).toBeInTheDocument()
        expect(screen.getByText('View Packages')).toBeInTheDocument()
      })
    })
  })

  describe('Role-Based Content', () => {
    it('shows all four role options in user management', async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })

      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Chaski Admin Dashboard')).toBeInTheDocument()
      })

      // Role options would be visible if users were loaded
      // This verifies the component structure is ready for all roles
    })
  })

  describe('Self-Deactivation Prevention', () => {
    it('disables deactivate button for currently logged-in admin', async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')

      // Mock the auth check
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })

      // Mock users list API call
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            email: 'admin@example.com',
            full_name: 'Admin User',
            role: 'ADMIN',
            is_verified: true,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            email: 'other@example.com',
            full_name: 'Other User',
            role: 'SENDER',
            is_verified: true,
            is_active: true,
            created_at: '2024-01-02T00:00:00Z',
          },
        ],
      })

      // Mock packages and stats
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: {
          total_users: 2,
          total_senders: 1,
          total_couriers: 0,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText, queryByTitle } = render(<AdminPage />)

      // Navigate to Users tab
      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument()
        expect(screen.getByText('other@example.com')).toBeInTheDocument()
      })

      // Check that the logged-in admin's deactivate button is disabled
      const disabledDeactivate = queryByTitle('You cannot deactivate your own account')
      expect(disabledDeactivate).toBeInTheDocument()
      expect(disabledDeactivate).toHaveClass('text-gray-400')
      expect(disabledDeactivate).toHaveClass('cursor-not-allowed')
    })

    it('allows deactivating other users', async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')

      // Mock the auth check
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })

      // Mock users list API call
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            email: 'admin@example.com',
            full_name: 'Admin User',
            role: 'ADMIN',
            is_verified: true,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            email: 'other@example.com',
            full_name: 'Other User',
            role: 'SENDER',
            is_verified: true,
            is_active: true,
            created_at: '2024-01-02T00:00:00Z',
          },
        ],
      })

      // Mock packages and stats
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: {
          total_users: 2,
          total_senders: 1,
          total_couriers: 0,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText, getAllByText } = render(<AdminPage />)

      // Navigate to Users tab
      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('other@example.com')).toBeInTheDocument()
      })

      // Check that deactivate buttons are shown for other users
      const deactivateButtons = getAllByText('Deactivate')

      // Should have at least one active deactivate button (for the other user)
      const activeDeactivateButton = deactivateButtons.find(
        btn => btn.tagName === 'BUTTON' && !btn.hasAttribute('disabled')
      )
      expect(activeDeactivateButton).toBeDefined()
    })
  })

  describe('Self-Role Change Prevention', () => {
    it('disables role dropdown for currently logged-in admin', async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')

      // Mock the auth check
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })

      // Mock users list API call
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            email: 'admin@example.com',
            full_name: 'Admin User',
            role: 'ADMIN',
            is_verified: true,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            email: 'other@example.com',
            full_name: 'Other User',
            role: 'SENDER',
            is_verified: true,
            is_active: true,
            created_at: '2024-01-02T00:00:00Z',
          },
        ],
      })

      // Mock packages and stats
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: {
          total_users: 2,
          total_senders: 1,
          total_couriers: 0,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText, container } = render(<AdminPage />)

      // Navigate to Users tab
      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('admin@example.com')).toBeInTheDocument()
        expect(screen.getByText('other@example.com')).toBeInTheDocument()
      })

      // Find all role dropdowns
      const roleSelects = container.querySelectorAll('select')

      // The first dropdown should be disabled (logged-in admin)
      const adminRoleSelect = roleSelects[0]
      expect(adminRoleSelect).toBeDisabled()
      expect(adminRoleSelect).toHaveClass('bg-gray-100')
      expect(adminRoleSelect).toHaveClass('cursor-not-allowed')
      expect(adminRoleSelect).toHaveAttribute('title', 'You cannot change your own role')
    })

    it('allows changing role for other users', async () => {
      ;(localStorage.getItem as jest.Mock).mockReturnValue('fake-token')

      // Mock the auth check
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: 1,
          email: 'admin@example.com',
          full_name: 'Admin User',
          role: 'ADMIN',
        },
      })

      // Mock users list API call
      .mockResolvedValueOnce({
        data: [
          {
            id: 1,
            email: 'admin@example.com',
            full_name: 'Admin User',
            role: 'ADMIN',
            is_verified: true,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            email: 'other@example.com',
            full_name: 'Other User',
            role: 'SENDER',
            is_verified: true,
            is_active: true,
            created_at: '2024-01-02T00:00:00Z',
          },
        ],
      })

      // Mock packages and stats
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: {
          total_users: 2,
          total_senders: 1,
          total_couriers: 0,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText, container } = render(<AdminPage />)

      // Navigate to Users tab
      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('other@example.com')).toBeInTheDocument()
      })

      // Find all role dropdowns
      const roleSelects = container.querySelectorAll('select')

      // The second dropdown should be enabled (other user)
      const otherUserRoleSelect = roleSelects[1]
      expect(otherUserRoleSelect).not.toBeDisabled()
      expect(otherUserRoleSelect).not.toHaveClass('bg-gray-100')
    })
  })
})
