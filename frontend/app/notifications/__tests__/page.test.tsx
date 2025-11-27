import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import NotificationsPage from '../page'
import { notificationsAPI, authAPI } from '@/lib/api'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock the Navbar component
jest.mock('@/components/Navbar', () => {
  return function MockNavbar({ user }: { user: any }) {
    return <nav data-testid="navbar">{user?.full_name}</nav>
  }
})

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

// Mock the API modules
jest.mock('@/lib/api', () => ({
  notificationsAPI: {
    getAll: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
  },
  authAPI: {
    getCurrentUser: jest.fn(),
  },
}))

const mockRouter = {
  push: jest.fn(),
  refresh: jest.fn(),
}

const mockUser = {
  id: 1,
  email: 'user@example.com',
  full_name: 'Test User',
  role: 'both',
  is_active: true,
  is_verified: true,
  max_deviation_km: 5,
  created_at: '2024-01-01T00:00:00Z',
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue(mockRouter)
    ;(authAPI.getCurrentUser as jest.Mock).mockResolvedValue({ data: mockUser })
    ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
      data: { notifications: [], total: 0, unread_count: 0 },
    })
  })

  describe('Page Rendering', () => {
    it('renders the notifications page header', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      })
    })

    it('shows loading state initially', () => {
      render(<NotificationsPage />)
      expect(screen.getByText('Loading notifications...')).toBeInTheDocument()
    })

    it('shows empty state when no notifications', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('No notifications yet')).toBeInTheDocument()
      })
    })
  })

  describe('Authentication', () => {
    it('redirects to login if not authenticated', async () => {
      ;(authAPI.getCurrentUser as jest.Mock).mockRejectedValue(new Error('Unauthorized'))

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login')
      })
    })
  })

  describe('Notification Display', () => {
    it('displays notifications with correct titles', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'package_delivered',
              message: 'Your package was delivered',
              read: false,
              package_id: 123,
              created_at: new Date().toISOString(),
            },
            {
              id: 2,
              user_id: 1,
              type: 'new_rating',
              message: 'You received a 5-star rating',
              read: true,
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 2,
          unread_count: 1,
        },
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Package Delivered')).toBeInTheDocument()
        expect(screen.getByText('New Rating Received')).toBeInTheDocument()
      })
    })

    it('displays notification messages', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'package_match_found',
              message: 'New package found along your route!',
              read: false,
              package_id: 456,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 1,
        },
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('New package found along your route!')).toBeInTheDocument()
      })
    })
  })

  describe('Notification Types and Icons', () => {
    const testCases = [
      { type: 'package_matched', title: 'Package Matched' },
      { type: 'package_picked_up', title: 'Package Picked Up' },
      { type: 'package_in_transit', title: 'Package In Transit' },
      { type: 'package_delivered', title: 'Package Delivered' },
      { type: 'package_cancelled', title: 'Package Cancelled' },
      { type: 'new_match_available', title: 'New Match Available' },
      { type: 'route_match_found', title: 'Route Match Found' },
      { type: 'new_rating', title: 'New Rating Received' },
      { type: 'package_match_found', title: 'Package Match Found' },
      { type: 'system', title: 'System Notification' },
    ]

    testCases.forEach(({ type, title }) => {
      it(`displays correct title for ${type} notification`, async () => {
        ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
          data: {
            notifications: [
              {
                id: 1,
                user_id: 1,
                type,
                message: 'Test message',
                read: false,
                package_id: null,
                created_at: new Date().toISOString(),
              },
            ],
            total: 1,
            unread_count: 1,
          },
        })

        render(<NotificationsPage />)

        await waitFor(() => {
          expect(screen.getByText(title)).toBeInTheDocument()
        })
      })
    })
  })

  describe('Notification Routing', () => {
    it('shows View link for new_rating notifications pointing to /profile/reviews', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'new_rating',
              message: 'You received a 5-star rating',
              read: false,
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 1,
        },
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        const viewLink = screen.getByText('View')
        expect(viewLink).toHaveAttribute('href', '/profile/reviews')
      })
    })

    it('shows View link for package_match_found notifications pointing to package page', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'package_match_found',
              message: 'New package found',
              read: false,
              package_id: 789,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 1,
        },
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        const viewLink = screen.getByText('View')
        expect(viewLink).toHaveAttribute('href', '/packages/789')
      })
    })

    it('shows View link for notifications with package_id', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'package_delivered',
              message: 'Package delivered',
              read: false,
              package_id: 100,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 1,
        },
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        const viewLink = screen.getByText('View')
        expect(viewLink).toHaveAttribute('href', '/packages/100')
      })
    })

    it('does not show View link for system notifications without package_id', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'system',
              message: 'System maintenance',
              read: false,
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 1,
        },
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('System maintenance')).toBeInTheDocument()
      })

      expect(screen.queryByText('View')).not.toBeInTheDocument()
    })
  })

  describe('Filter Tabs', () => {
    it('renders filter tabs', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument()
        expect(screen.getByText('Unread')).toBeInTheDocument()
      })
    })

    it('filters to unread when Unread tab is clicked', async () => {
      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Unread')).toBeInTheDocument()
      })

      const unreadButton = screen.getByText('Unread')
      fireEvent.click(unreadButton)

      await waitFor(() => {
        expect(notificationsAPI.getAll).toHaveBeenCalledWith(true)
      })
    })
  })

  describe('Mark as Read', () => {
    it('calls markAsRead API when clicking mark as read button', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'system',
              message: 'Test notification',
              read: false,
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 1,
        },
      })
      ;(notificationsAPI.markAsRead as jest.Mock).mockResolvedValue({ data: {} })

      render(<NotificationsPage />)

      await waitFor(() => {
        const markReadButton = screen.getByTitle('Mark as read')
        fireEvent.click(markReadButton)
      })

      expect(notificationsAPI.markAsRead).toHaveBeenCalledWith(1)
    })

    it('shows Mark all as read button when there are unread notifications', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'system',
              message: 'Unread notification',
              read: false,
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 1,
        },
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('Mark all as read')).toBeInTheDocument()
      })
    })
  })

  describe('Delete Notification', () => {
    it('calls delete API when clicking delete button', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'system',
              message: 'Test notification',
              read: false,
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 1,
        },
      })
      ;(notificationsAPI.delete as jest.Mock).mockResolvedValue({ data: {} })

      render(<NotificationsPage />)

      await waitFor(() => {
        const deleteButton = screen.getByTitle('Delete notification')
        fireEvent.click(deleteButton)
      })

      expect(notificationsAPI.delete).toHaveBeenCalledWith(1)
    })
  })

  describe('Unread Count Display', () => {
    it('displays unread count in header', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'system',
              message: 'Notification 1',
              read: false,
              package_id: null,
              created_at: new Date().toISOString(),
            },
            {
              id: 2,
              user_id: 1,
              type: 'system',
              message: 'Notification 2',
              read: false,
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 2,
          unread_count: 2,
        },
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('2 unread')).toBeInTheDocument()
      })
    })

    it('displays "All caught up!" when no unread notifications', async () => {
      ;(notificationsAPI.getAll as jest.Mock).mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'system',
              message: 'Read notification',
              read: true,
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 0,
        },
      })

      render(<NotificationsPage />)

      await waitFor(() => {
        expect(screen.getByText('All caught up!')).toBeInTheDocument()
      })
    })
  })
})
