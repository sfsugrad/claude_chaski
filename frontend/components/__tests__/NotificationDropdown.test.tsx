import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NotificationDropdown from '../NotificationDropdown'
import { notificationsAPI } from '@/lib/api'

// Mock the API
jest.mock('@/lib/api', () => ({
  notificationsAPI: {
    getAll: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  },
}))

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

const mockNotificationsAPI = notificationsAPI as jest.Mocked<typeof notificationsAPI>

describe('NotificationDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default mock for unread count
    mockNotificationsAPI.getUnreadCount.mockResolvedValue({
      data: { unread_count: 0 },
    } as any)
  })

  describe('Initial Rendering', () => {
    it('renders notification bell button', () => {
      render(<NotificationDropdown />)

      const button = screen.getByRole('button', { name: /notifications/i })
      expect(button).toBeInTheDocument()
    })

    it('shows unread badge when there are unread notifications', async () => {
      mockNotificationsAPI.getUnreadCount.mockResolvedValue({
        data: { unread_count: 5 },
      } as any)

      render(<NotificationDropdown />)

      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument()
      })
    })

    it('shows 99+ when unread count exceeds 99', async () => {
      mockNotificationsAPI.getUnreadCount.mockResolvedValue({
        data: { unread_count: 150 },
      } as any)

      render(<NotificationDropdown />)

      await waitFor(() => {
        expect(screen.getByText('99+')).toBeInTheDocument()
      })
    })

    it('does not show badge when unread count is 0', async () => {
      mockNotificationsAPI.getUnreadCount.mockResolvedValue({
        data: { unread_count: 0 },
      } as any)

      render(<NotificationDropdown />)

      await waitFor(() => {
        expect(screen.queryByText('0')).not.toBeInTheDocument()
      })
    })
  })

  describe('Dropdown Toggle', () => {
    it('opens dropdown when bell button is clicked', async () => {
      mockNotificationsAPI.getAll.mockResolvedValue({
        data: { notifications: [], total: 0, unread_count: 0 },
      } as any)

      render(<NotificationDropdown />)

      const button = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      })
    })

    it('closes dropdown when clicking outside', async () => {
      mockNotificationsAPI.getAll.mockResolvedValue({
        data: { notifications: [], total: 0, unread_count: 0 },
      } as any)

      render(
        <div>
          <NotificationDropdown />
          <div data-testid="outside">Outside</div>
        </div>
      )

      // Open dropdown
      const button = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      })

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'))

      await waitFor(() => {
        expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument()
      })
    })
  })

  describe('Notification List', () => {
    it('shows empty state when no notifications', async () => {
      mockNotificationsAPI.getAll.mockResolvedValue({
        data: { notifications: [], total: 0, unread_count: 0 },
      } as any)

      render(<NotificationDropdown />)

      const button = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('No notifications yet')).toBeInTheDocument()
      })
    })

    it('correctly transforms backend response with notifications array', async () => {
      // This tests the bug fix - backend returns { notifications: [...], total, unread_count }
      mockNotificationsAPI.getAll.mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'package_matched',
              message: 'Your package has been matched!',
              read: false, // Backend uses 'read', not 'is_read'
              package_id: 123,
              created_at: new Date().toISOString(),
            },
            {
              id: 2,
              user_id: 1,
              type: 'route_match_found',
              message: 'Found 3 packages along your route',
              read: true,
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 2,
          unread_count: 1,
        },
      } as any)

      render(<NotificationDropdown />)

      const button = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(button)

      await waitFor(() => {
        // Verify notifications are displayed with generated titles
        expect(screen.getByText('Package Matched')).toBeInTheDocument()
        expect(screen.getByText('Route Match Found')).toBeInTheDocument()
        expect(screen.getByText('Your package has been matched!')).toBeInTheDocument()
        expect(screen.getByText('Found 3 packages along your route')).toBeInTheDocument()
      })
    })

    it('handles backend read field transformation to is_read', async () => {
      mockNotificationsAPI.getAll.mockResolvedValue({
        data: {
          notifications: [
            {
              id: 1,
              user_id: 1,
              type: 'system',
              message: 'Unread notification',
              read: false, // Backend format
              package_id: null,
              created_at: new Date().toISOString(),
            },
          ],
          total: 1,
          unread_count: 1,
        },
      } as any)

      render(<NotificationDropdown />)

      const button = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(button)

      await waitFor(() => {
        // Unread notifications should have blue background
        const notificationItem = screen.getByText('Unread notification').closest('div')
        expect(notificationItem).toBeInTheDocument()
      })
    })

    it('shows loading state while fetching', async () => {
      // Make the API call hang
      mockNotificationsAPI.getAll.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<NotificationDropdown />)

      const button = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(button)

      // Should show loading spinner
      await waitFor(() => {
        expect(document.querySelector('.animate-spin')).toBeInTheDocument()
      })
    })

    it('shows error state when fetch fails', async () => {
      mockNotificationsAPI.getAll.mockRejectedValue(new Error('Network error'))

      render(<NotificationDropdown />)

      const button = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByText('Failed to load notifications')).toBeInTheDocument()
      })
    })
  })

  describe('Mark as Read', () => {
    it('calls markAsRead when clicking unread indicator', async () => {
      mockNotificationsAPI.getAll.mockResolvedValue({
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
      } as any)
      mockNotificationsAPI.markAsRead.mockResolvedValue({ data: {} } as any)

      render(<NotificationDropdown />)

      const button = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(button)

      await waitFor(() => {
        const markReadButton = screen.getByTitle('Mark as read')
        fireEvent.click(markReadButton)
      })

      expect(mockNotificationsAPI.markAsRead).toHaveBeenCalledWith(1)
    })

    it('calls markAllAsRead when clicking mark all as read', async () => {
      mockNotificationsAPI.getUnreadCount.mockResolvedValue({
        data: { unread_count: 3 },
      } as any)
      mockNotificationsAPI.getAll.mockResolvedValue({
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
      } as any)
      mockNotificationsAPI.markAllAsRead.mockResolvedValue({ data: {} } as any)

      render(<NotificationDropdown />)

      // Wait for unread count to be fetched
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument()
      })

      // Open dropdown
      const button = screen.getByRole('button', { name: /notifications/i })
      fireEvent.click(button)

      await waitFor(() => {
        const markAllButton = screen.getByText('Mark all as read')
        fireEvent.click(markAllButton)
      })

      expect(mockNotificationsAPI.markAllAsRead).toHaveBeenCalled()
    })
  })

  describe('Notification Types', () => {
    const testNotificationTypes = [
      { type: 'package_matched', expectedTitle: 'Package Matched' },
      { type: 'package_picked_up', expectedTitle: 'Package Picked Up' },
      { type: 'package_in_transit', expectedTitle: 'Package In Transit' },
      { type: 'package_delivered', expectedTitle: 'Package Delivered' },
      { type: 'package_cancelled', expectedTitle: 'Package Cancelled' },
      { type: 'new_match_available', expectedTitle: 'New Match Available' },
      { type: 'route_match_found', expectedTitle: 'Route Match Found' },
      { type: 'system', expectedTitle: 'System Notification' },
    ]

    testNotificationTypes.forEach(({ type, expectedTitle }) => {
      it(`generates correct title for ${type} notification type`, async () => {
        mockNotificationsAPI.getAll.mockResolvedValue({
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
        } as any)

        render(<NotificationDropdown />)

        const button = screen.getByRole('button', { name: /notifications/i })
        fireEvent.click(button)

        await waitFor(() => {
          expect(screen.getByText(expectedTitle)).toBeInTheDocument()
        })
      })
    })
  })
})
