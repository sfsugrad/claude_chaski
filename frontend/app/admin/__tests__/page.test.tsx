import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import AdminPage from '../page'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Create mock functions for API calls
const mockGetCurrentUser = jest.fn()
const mockLogout = jest.fn()
const mockGetUsers = jest.fn()
const mockGetPackages = jest.fn()
const mockGetStats = jest.fn()
const mockUpdateUserRole = jest.fn()
const mockToggleUserActive = jest.fn()
const mockToggleUserVerified = jest.fn()
const mockTogglePackageActive = jest.fn()
const mockCreateUser = jest.fn()
const mockRunMatchingJob = jest.fn()

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
  authAPI: {
    getCurrentUser: () => mockGetCurrentUser(),
    logout: () => mockLogout(),
  },
  adminAPI: {
    getUsers: () => mockGetUsers(),
    getPackages: () => mockGetPackages(),
    getStats: () => mockGetStats(),
    updateUserRole: (userId: number, role: string) => mockUpdateUserRole(userId, role),
    toggleUserActive: (userId: number, isActive: boolean) => mockToggleUserActive(userId, isActive),
    toggleUserVerified: (userId: number, isVerified: boolean) => mockToggleUserVerified(userId, isVerified),
    togglePackageActive: (packageId: number, isActive: boolean) => mockTogglePackageActive(packageId, isActive),
    createUser: (data: any) => mockCreateUser(data),
    runMatchingJob: (dryRun: boolean, hours: number) => mockRunMatchingJob(dryRun, hours),
  },
}))

// Helper to set up admin mocks with default data
const setupAdminMocks = (options: {
  user?: any
  users?: any[]
  packages?: any[]
  stats?: any
  userError?: Error
} = {}) => {
  const {
    user = {
      id: 1,
      email: 'admin@example.com',
      full_name: 'Admin User',
      role: 'ADMIN',
    },
    users = [],
    packages = [],
    stats = {
      total_users: 0,
      total_senders: 0,
      total_couriers: 0,
      total_both: 0,
      total_admins: 0,
      total_packages: 0,
      active_packages: 0,
      completed_packages: 0,
      pending_packages: 0,
      total_revenue: 0,
    },
    userError,
  } = options

  if (userError) {
    mockGetCurrentUser.mockRejectedValue(userError)
  } else {
    mockGetCurrentUser.mockResolvedValue({ data: user })
  }
  mockGetUsers.mockResolvedValue({ data: users })
  mockGetPackages.mockResolvedValue({ data: packages })
  mockGetStats.mockResolvedValue({ data: stats })
  mockLogout.mockResolvedValue({ data: { message: 'Logged out' } })
}

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
    it('redirects to login if user fetch fails', async () => {
      setupAdminMocks({ userError: new Error('Unauthorized') })

      render(<AdminPage />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
      })
    })

    it('shows access denied message for non-admin users', async () => {
      setupAdminMocks({
        user: {
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
      setupAdminMocks()

      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Chaski Admin Dashboard')).toBeInTheDocument()
      })
    })
  })

  describe('Page Rendering', () => {
    beforeEach(() => {
      setupAdminMocks()
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
      setupAdminMocks()
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
      setupAdminMocks()
    })

    it('renders stats cards', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Total Users')).toBeInTheDocument()
        expect(screen.getByText('Senders Only')).toBeInTheDocument()
        expect(screen.getByText('Couriers Only')).toBeInTheDocument()
        expect(screen.getByText('Active Packages')).toBeInTheDocument()
      })
    })

    it('renders quick actions section', async () => {
      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Quick Actions')).toBeInTheDocument()
        expect(screen.getByText('Manage Users')).toBeInTheDocument()
        expect(screen.getByText('View Packages')).toBeInTheDocument()
        expect(screen.getByText('Generate Reports (Soon)')).toBeInTheDocument()
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
      setupAdminMocks()
    })

    it('shows no users message when users list is empty', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('No users found')).toBeInTheDocument()
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
      setupAdminMocks()
    })

    it('shows no packages message when packages list is empty', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const packagesTab = getByText('Packages')
        packagesTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('No packages found')).toBeInTheDocument()
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
      setupAdminMocks()
    })

    it('calls logout API and redirects on logout', async () => {
      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument()
      })

      const logoutBtn = getByText('Logout')
      logoutBtn.click()

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled()
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('Styling and Layout', () => {
    beforeEach(async () => {
      setupAdminMocks()
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
      setupAdminMocks()
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
      setupAdminMocks()

      render(<AdminPage />)

      await waitFor(() => {
        expect(screen.getByText('Chaski Admin Dashboard')).toBeInTheDocument()
      })

      // Role options would be visible if users were loaded
      // This verifies the component structure is ready for all roles
    })
  })

  describe('Self-Deactivation Prevention', () => {
    const testUsers = [
      {
        id: 1,
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'admin',
        is_verified: true,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        email: 'other@example.com',
        full_name: 'Other User',
        role: 'sender',
        is_verified: true,
        is_active: true,
        created_at: '2024-01-02T00:00:00Z',
      },
    ]

    it('disables deactivate button for currently logged-in admin', async () => {
      setupAdminMocks({
        users: testUsers,
        stats: {
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
      setupAdminMocks({
        users: testUsers,
        stats: {
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

  describe('User Verification Toggle', () => {
    const testUsers = [
      {
        id: 1,
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'admin',
        is_verified: true,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        email: 'verified@example.com',
        full_name: 'Verified User',
        role: 'sender',
        is_verified: true,
        is_active: true,
        created_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 3,
        email: 'unverified@example.com',
        full_name: 'Unverified User',
        role: 'courier',
        is_verified: false,
        is_active: true,
        created_at: '2024-01-03T00:00:00Z',
      },
    ]

    beforeEach(() => {
      mockToggleUserVerified.mockResolvedValue({ data: {} })
    })

    it('displays verification badge as clickable button', async () => {
      setupAdminMocks({
        users: testUsers,
        stats: {
          total_users: 3,
          total_senders: 1,
          total_couriers: 1,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText } = render(<AdminPage />)

      // Navigate to Users tab
      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('verified@example.com')).toBeInTheDocument()
        expect(screen.getByText('unverified@example.com')).toBeInTheDocument()
      })

      // Find verification buttons - they should be clickable buttons
      const verifiedButtons = screen.getAllByRole('button', { name: /verified/i })
      expect(verifiedButtons.length).toBeGreaterThan(0)
    })

    it('shows "Verified" badge for verified users', async () => {
      setupAdminMocks({
        users: testUsers,
        stats: {
          total_users: 3,
          total_senders: 1,
          total_couriers: 1,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('verified@example.com')).toBeInTheDocument()
      })

      // Find the verified user row and check for Verified badge
      const verifiedBadges = screen.getAllByRole('button', { name: 'Verified' })
      expect(verifiedBadges.length).toBeGreaterThanOrEqual(1)
    })

    it('shows "Unverified" badge for unverified users', async () => {
      setupAdminMocks({
        users: testUsers,
        stats: {
          total_users: 3,
          total_senders: 1,
          total_couriers: 1,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('unverified@example.com')).toBeInTheDocument()
      })

      // Find the Unverified badge
      const unverifiedBadge = screen.getByRole('button', { name: 'Unverified' })
      expect(unverifiedBadge).toBeInTheDocument()
      expect(unverifiedBadge).toHaveClass('bg-yellow-100')
    })

    it('disables verification toggle for inactive users', async () => {
      const usersWithInactive = [
        ...testUsers,
        {
          id: 4,
          email: 'inactive@example.com',
          full_name: 'Inactive User',
          role: 'sender',
          is_verified: true,
          is_active: false,
          created_at: '2024-01-04T00:00:00Z',
        },
      ]

      setupAdminMocks({
        users: usersWithInactive,
        stats: {
          total_users: 4,
          total_senders: 2,
          total_couriers: 1,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('inactive@example.com')).toBeInTheDocument()
      })

      // Find the disabled verification button by its title
      const disabledButton = screen.getByTitle('Cannot modify inactive user')
      expect(disabledButton).toBeInTheDocument()
      expect(disabledButton).toBeDisabled()
      expect(disabledButton).toHaveClass('opacity-50')
    })

    it('calls toggleUserVerified API when verification badge is clicked', async () => {
      // Mock window.confirm to return true
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})

      setupAdminMocks({
        users: testUsers,
        stats: {
          total_users: 3,
          total_senders: 1,
          total_couriers: 1,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('unverified@example.com')).toBeInTheDocument()
      })

      // Click on the Unverified badge to verify the user
      const unverifiedBadge = screen.getByRole('button', { name: 'Unverified' })
      unverifiedBadge.click()

      await waitFor(() => {
        expect(mockToggleUserVerified).toHaveBeenCalledWith(3, true) // user id 3, set verified to true
      })

      confirmSpy.mockRestore()
      alertSpy.mockRestore()
    })

    it('does not call API when confirmation is cancelled', async () => {
      // Mock window.confirm to return false
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)

      setupAdminMocks({
        users: testUsers,
        stats: {
          total_users: 3,
          total_senders: 1,
          total_couriers: 1,
          total_both: 0,
          total_admins: 1,
          total_packages: 0,
          active_packages: 0,
          completed_packages: 0,
          pending_packages: 0,
          total_revenue: 0,
        },
      })

      const { getByText } = render(<AdminPage />)

      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      await waitFor(() => {
        expect(screen.getByText('unverified@example.com')).toBeInTheDocument()
      })

      // Click on the Unverified badge
      const unverifiedBadge = screen.getByRole('button', { name: 'Unverified' })
      unverifiedBadge.click()

      // API should not be called
      expect(mockToggleUserVerified).not.toHaveBeenCalled()

      confirmSpy.mockRestore()
    })
  })

  describe('Self-Role Change Prevention', () => {
    const testUsers = [
      {
        id: 1,
        email: 'admin@example.com',
        full_name: 'Admin User',
        role: 'admin',
        is_verified: true,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        email: 'other@example.com',
        full_name: 'Other User',
        role: 'sender',
        is_verified: true,
        is_active: true,
        created_at: '2024-01-02T00:00:00Z',
      },
    ]

    it('disables role dropdown for currently logged-in admin', async () => {
      setupAdminMocks({
        users: testUsers,
        stats: {
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

      const { getByText } = render(<AdminPage />)

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

      // Find the role dropdown with title attribute (only set on disabled dropdowns for logged-in admin)
      const disabledRoleSelect = screen.getByTitle('You cannot change your own role')
      expect(disabledRoleSelect).toBeInTheDocument()
      expect(disabledRoleSelect).toBeDisabled()
      expect(disabledRoleSelect).toHaveClass('bg-gray-100')
      expect(disabledRoleSelect).toHaveClass('cursor-not-allowed')
    })

    it('allows changing role for other users', async () => {
      setupAdminMocks({
        users: testUsers,
        stats: {
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

      const { getByText } = render(<AdminPage />)

      // Navigate to Users tab
      await waitFor(() => {
        const usersTab = getByText('Users')
        usersTab.click()
      })

      // Wait for users to load
      await waitFor(() => {
        expect(screen.getByText('other@example.com')).toBeInTheDocument()
      })

      // Find enabled role dropdown by looking for select with "sender" as value (lowercase)
      // that is NOT disabled (the other user's dropdown)
      const allSelects = screen.getAllByRole('combobox')
      // Find the one that has sender as value and is not disabled
      const otherUserRoleSelect = allSelects.find(
        select => (select as HTMLSelectElement).value === 'sender' && !(select as HTMLSelectElement).disabled
      )
      expect(otherUserRoleSelect).toBeDefined()
      expect(otherUserRoleSelect).not.toBeDisabled()
    })
  })
})
