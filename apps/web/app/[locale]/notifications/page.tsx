'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authAPI, notificationsAPI, UserResponse, NotificationType } from '@/lib/api'
import Navbar from '@/components/Navbar'
import { Card, Button, Alert, FadeIn, SlideIn, NotificationsSkeleton } from '@/components/ui'

interface DisplayNotification {
  id: number
  user_id: number
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  package_id: number | null
  created_at: string
}

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  package_matched: '🤝',
  package_picked_up: '📦',
  package_in_transit: '🚚',
  package_delivered: '✅',
  package_cancelled: '❌',
  new_match_available: '🔔',
  route_match_found: '🛣️',
  new_rating: '⭐',
  package_match_found: '📍',
  system: 'ℹ️',
}

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  package_matched: 'bg-primary-50 border-primary-200',
  package_picked_up: 'bg-primary-50 border-primary-200',
  package_in_transit: 'bg-info-50 border-info-200',
  package_delivered: 'bg-success-50 border-success-200',
  package_cancelled: 'bg-error-50 border-error-200',
  new_match_available: 'bg-warning-50 border-warning-200',
  route_match_found: 'bg-info-50 border-info-200',
  new_rating: 'bg-warning-50 border-warning-200',
  package_match_found: 'bg-info-50 border-info-200',
  system: 'bg-surface-50 border-surface-200',
}

const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  package_matched: 'Package Matched',
  package_picked_up: 'Package Picked Up',
  package_in_transit: 'Package In Transit',
  package_delivered: 'Package Delivered',
  package_cancelled: 'Package Cancelled',
  new_match_available: 'New Match Available',
  route_match_found: 'Route Match Found',
  new_rating: 'New Rating Received',
  package_match_found: 'Package Match Found',
  system: 'System Notification',
}

// Helper to get the appropriate link for a notification
function getNotificationLink(notification: DisplayNotification): string | null {
  // Rating notifications go to reviews page
  if (notification.type === 'new_rating') {
    return '/profile/reviews'
  }
  // Bid rejected/expired notifications go to bid history (courier can't access the package)
  if (notification.type === 'bid_rejected' || notification.type === 'bid_deadline_expired') {
    return '/courier?tab=history'
  }
  // Package-related notifications go to package page
  if (notification.package_id) {
    return `/packages/${notification.package_id}`
  }
  // No link for other notifications
  return null
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export default function NotificationsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [notifications, setNotifications] = useState<DisplayNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    loadData()
  }, [filter])

  const loadData = async () => {
    try {
      const userResponse = await authAPI.getCurrentUser()
      setUser(userResponse.data)

      const notificationsResponse = await notificationsAPI.getAll(filter === 'unread')
      const transformedNotifications: DisplayNotification[] = notificationsResponse.data.notifications.map((n: any) => ({
        id: n.id,
        user_id: n.user_id,
        type: n.type as NotificationType,
        title: NOTIFICATION_TITLES[n.type as NotificationType] || 'Notification',
        message: n.message,
        is_read: n.read,
        package_id: n.package_id,
        created_at: n.created_at,
      }))
      setNotifications(transformedNotifications)
    } catch (err) {
      setError('Please log in to view notifications.')
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsRead = async (id: number) => {
    try {
      await notificationsAPI.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await notificationsAPI.delete(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  if (loading) {
    return <NotificationsSkeleton />
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <Navbar user={user} />

      <div className="page-container py-8 max-w-3xl">
        {/* Header */}
        <FadeIn duration={400}>
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="text-primary-600 hover:text-primary-800 text-sm mb-4 inline-block"
            >
              &larr; Back to Dashboard
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-surface-900">Notifications</h1>
                <p className="text-surface-600 mt-1">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                >
                  Mark all as read
                </Button>
              )}
            </div>
          </div>
        </FadeIn>

        {error && (
          <Alert variant="error" className="mb-6">
            {error}
          </Alert>
        )}

        {/* Filter Tabs */}
        <SlideIn direction="up" delay={100}>
          <div className="flex gap-2 mb-6">
            <Button
              variant={filter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'unread' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread
            </Button>
          </div>
        </SlideIn>

        {/* Notifications List */}
        <SlideIn direction="up" delay={200}>
          <Card>
            {notifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-4">🔔</div>
                <p className="text-surface-600">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-sm text-surface-500 mt-2">
                  You'll be notified when there's activity on your packages or routes.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-surface-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 transition-colors ${
                      !notification.is_read ? 'bg-primary-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl border ${
                          NOTIFICATION_COLORS[notification.type]
                        }`}
                      >
                        {NOTIFICATION_ICONS[notification.type]}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-surface-900">
                              {notification.title}
                            </p>
                            <p className="text-surface-600 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-sm text-surface-400 mt-2">
                              {formatTimeAgo(notification.created_at)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 ml-4">
                            {getNotificationLink(notification) && (
                              <Link
                                href={getNotificationLink(notification)!}
                                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                              >
                                View
                              </Link>
                            )}
                            {!notification.is_read && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="text-sm text-surface-500 hover:text-surface-700"
                                title="Mark as read"
                              >
                                <span className="w-2 h-2 bg-primary-500 rounded-full inline-block"></span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(notification.id)}
                              className="text-sm text-surface-400 hover:text-error-600 transition-colors"
                              title="Delete notification"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </SlideIn>
      </div>
    </div>
  )
}
