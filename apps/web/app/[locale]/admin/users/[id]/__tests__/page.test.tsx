import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useRouter, useParams } from 'next/navigation'
import UserDetailPage from '../page'

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}))

// Create mock functions for API calls
const mockGetCurrentUser = jest.fn()
const mockGetUser = jest.fn()
const mockGetPackages = jest.fn()
const mockGetRoutes = jest.fn()
const mockUpdateUserRole = jest.fn()
const mockToggleUserActive = jest.fn()
const mockToggleUserVerified = jest.fn()
const mockToggleUserPhoneVerified = jest.fn()
const mockToggleUserIdVerified = jest.fn()
const mockUpdateUserProfile = jest.fn()

jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
  authAPI: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
  adminAPI: {
    getUser: (userId: number) => mockGetUser(userId),
    getPackages: () => mockGetPackages(),
    getRoutes: () => mockGetRoutes(),
    updateUserRole: (userId: number, role: string) => mockUpdateUserRole(userId, role),
    toggleUserActive: (userId: number, isActive: boolean) => mockToggleUserActive(userId, isActive),
    toggleUserVerified: (userId: number, isVerified: boolean) => mockToggleUserVerified(userId, isVerified),
    toggleUserPhoneVerified: (userId: number, phoneVerified: boolean) => mockToggleUserPhoneVerified(userId, phoneVerified),
    toggleUserIdVerified: (userId: number, idVerified: boolean) => mockToggleUserIdVerified(userId, idVerified),
    updateUserProfile: (userId: number, data: any) => mockUpdateUserProfile(userId, data),
  },
}))

const mockAdminUser = {
  id: 1,
  email: 'admin@example.com',
  full_name: 'Admin User',
  role: 'admin',
  is_verified: true,
  is_active: true,
}

const mockTargetUser = {
  id: 2,
  email: 'user@example.com',
  full_name: 'Test User',
  role: 'sender',
  phone_number: '+1234567890',
  is_verified: true,
  is_active: true,
  max_deviation_km: 10,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
}

const mockUnverifiedUser = {
  id: 3,
  email: 'unverified@example.com',
  full_name: 'Unverified User',
  role: 'courier',
  phone_number: null,
  is_verified: false,
  is_active: true,
  max_deviation_km: 5,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: null,
}

describe('UserDetailPage', () => {
  const mockRouter = {
    push: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(useParams as jest.Mock).mockReturnValue({ id: '2' })

    // Default successful mocks
    mockGetCurrentUser.mockResolvedValue({ data: mockAdminUser })
    mockGetUser.mockResolvedValue({ data: mockTargetUser })
    mockGetPackages.mockResolvedValue({ data: [] })
    mockGetRoutes.mockResolvedValue({ data: [] })
    mockToggleUserVerified.mockResolvedValue({ data: { ...mockTargetUser, is_verified: false } })
    mockToggleUserPhoneVerified.mockResolvedValue({ data: { ...mockTargetUser, phone_verified: false } })
    mockToggleUserIdVerified.mockResolvedValue({ data: { ...mockTargetUser, id_verified: false } })
    mockToggleUserActive.mockResolvedValue({ data: { ...mockTargetUser, is_active: false } })
    mockUpdateUserRole.mockResolvedValue({ data: { ...mockTargetUser, role: 'courier' } })
    mockUpdateUserProfile.mockResolvedValue({ data: mockTargetUser })

    // Mock window methods
    jest.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Page Rendering', () => {
    it('renders loading state initially', () => {
      render(<UserDetailPage />)
      expect(screen.getByText('Loading user details...')).toBeInTheDocument()
    })

    it('renders user details after loading', async () => {
      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      // User name appears in header - use getAllByText since it may appear multiple times
      const userNames = screen.getAllByText('Test User')
      expect(userNames.length).toBeGreaterThan(0)
      expect(screen.getByText('user@example.com')).toBeInTheDocument()
    })

    it('shows access denied for non-admin users', async () => {
      mockGetCurrentUser.mockResolvedValue({
        data: { ...mockAdminUser, role: 'sender' },
      })

      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('Access denied. Admin privileges required.')).toBeInTheDocument()
      })
    })

    it('shows error when user not found', async () => {
      mockGetUser.mockRejectedValue({ response: { status: 404 } })

      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.getByText('User not found')).toBeInTheDocument()
      })
    })
  })

  describe('Verification Status Display', () => {
    it('displays verification status section', async () => {
      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      expect(screen.getByText('Verification Status')).toBeInTheDocument()
    })

    it('shows Edit User button', async () => {
      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      expect(screen.getByText('Edit User')).toBeInTheDocument()
    })
  })

  describe('Edit Mode - Verification Toggle', () => {
    it('shows Save and Cancel buttons in edit mode', async () => {
      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      // Click Edit button
      fireEvent.click(screen.getByText('Edit User'))

      expect(screen.getByText('Save Changes')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('shows verification radio buttons in edit mode', async () => {
      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      // Click Edit button
      fireEvent.click(screen.getByText('Edit User'))

      // Check for radio buttons - there should be verification options
      const radioButtons = screen.getAllByRole('radio')
      expect(radioButtons.length).toBeGreaterThanOrEqual(2)
    })

    it('calls toggleUserVerified API when saving changed verification status', async () => {
      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      // Click Edit button
      fireEvent.click(screen.getByText('Edit User'))

      // Find all radio buttons and click one that changes verification
      const radioButtons = screen.getAllByRole('radio')
      // Find the Unverified radio (should be unchecked for verified user)
      const unverifiedRadio = radioButtons.find(
        radio => !radio.hasAttribute('checked') && radio.getAttribute('name') === 'is_verified'
      )
      if (unverifiedRadio) {
        fireEvent.click(unverifiedRadio)
      }

      // Click Save button
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockToggleUserVerified).toHaveBeenCalledWith(2, false)
      })
    })

    it('does not call toggleUserVerified API when verification status unchanged', async () => {
      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      // Click Edit button
      fireEvent.click(screen.getByText('Edit User'))

      // Don't change anything, just save
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockToggleUserVerified).not.toHaveBeenCalled()
      })
    })

    it('shows success message after saving', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})

      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      // Click Edit button
      fireEvent.click(screen.getByText('Edit User'))

      // Click Save button (no changes)
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('User updated successfully')
      })

      alertSpy.mockRestore()
    })
  })

  describe('Cancel Edit', () => {
    it('exits edit mode when cancel is clicked', async () => {
      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      // Click Edit button
      fireEvent.click(screen.getByText('Edit User'))
      expect(screen.getByText('Save Changes')).toBeInTheDocument()

      // Click Cancel button
      fireEvent.click(screen.getByText('Cancel'))

      // Should exit edit mode
      await waitFor(() => {
        expect(screen.getByText('Edit User')).toBeInTheDocument()
        expect(screen.queryByText('Save Changes')).not.toBeInTheDocument()
      })
    })

    it('does not call API when cancelled', async () => {
      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      // Click Edit button
      fireEvent.click(screen.getByText('Edit User'))

      // Click Cancel button
      fireEvent.click(screen.getByText('Cancel'))

      expect(mockToggleUserVerified).not.toHaveBeenCalled()
      expect(mockUpdateUserProfile).not.toHaveBeenCalled()
    })
  })

  describe('API Error Handling', () => {
    it('shows error alert when toggleUserVerified fails', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
      mockToggleUserVerified.mockRejectedValue({
        response: { data: { detail: 'Verification update failed' } },
      })

      render(<UserDetailPage />)

      await waitFor(() => {
        expect(screen.queryByText('Loading user details...')).not.toBeInTheDocument()
      })

      // Click Edit button
      fireEvent.click(screen.getByText('Edit User'))

      // Find and click the unverified radio
      const radioButtons = screen.getAllByRole('radio')
      const unverifiedRadio = radioButtons.find(
        radio => radio.getAttribute('name') === 'is_verified' && !radio.hasAttribute('checked')
      )
      if (unverifiedRadio) {
        fireEvent.click(unverifiedRadio)
      }

      // Click Save button
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Verification update failed')
      })

      alertSpy.mockRestore()
    })
  })
})
