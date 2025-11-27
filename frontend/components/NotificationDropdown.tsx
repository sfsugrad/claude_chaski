'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { notificationsAPI, NotificationType } from '@/lib/api'

// Internal notification type with transformed fields from backend
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
  system: 'ℹ️',
}

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  package_matched: 'bg-blue-50 border-blue-200',
  package_picked_up: 'bg-purple-50 border-purple-200',
  package_in_transit: 'bg-indigo-50 border-indigo-200',
  package_delivered: 'bg-green-50 border-green-200',
  package_cancelled: 'bg-red-50 border-red-200',
  new_match_available: 'bg-yellow-50 border-yellow-200',
  route_match_found: 'bg-teal-50 border-teal-200',
  system: 'bg-gray-50 border-gray-200',
}

const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  package_matched: 'Package Matched',
  package_picked_up: 'Package Picked Up',
  package_in_transit: 'Package In Transit',
  package_delivered: 'Package Delivered',
  package_cancelled: 'Package Cancelled',
  new_match_available: 'New Match Available',
  route_match_found: 'Route Match Found',
  system: 'System Notification',
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

interface NotificationDropdownProps {
  className?: string
}

export default function NotificationDropdown({ className = '' }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<DisplayNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch unread count on mount and periodically
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000) // Poll every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount()
      setUnreadCount(response.data.unread_count)
    } catch (err) {
      // Silently fail - notification count is not critical
      console.error('Failed to fetch notification count:', err)
    }
  }

  const fetchNotifications = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await notificationsAPI.getAll()
      // Transform backend response to display format
      const transformedNotifications: DisplayNotification[] = response.data.notifications.map((n: any) => ({
        id: n.id,
        user_id: n.user_id,
        type: n.type as NotificationType,
        title: NOTIFICATION_TITLES[n.type as NotificationType] || 'Notification',
        message: n.message,
        is_read: n.read, // Backend uses 'read', frontend uses 'is_read'
        package_id: n.package_id,
        created_at: n.created_at,
      }))
      setNotifications(transformedNotifications)
    } catch (err) {
      setError('Failed to load notifications')
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications()
    }
    setIsOpen(!isOpen)
  }

  const handleMarkAsRead = async (id: number, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await notificationsAPI.markAsRead(id)
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    }
  }

  const handleNotificationClick = (notification: DisplayNotification) => {
    if (!notification.is_read) {
      notificationsAPI.markAsRead(notification.id).catch(console.error)
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
    setIsOpen(false)
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-sm text-red-600">
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    {notification.package_id ? (
                      <Link
                        href={`/packages/${notification.package_id}`}
                        onClick={() => handleNotificationClick(notification)}
                        className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${
                          !notification.is_read ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <NotificationContent
                          notification={notification}
                          onMarkAsRead={handleMarkAsRead}
                        />
                      </Link>
                    ) : (
                      <div
                        onClick={() => handleNotificationClick(notification)}
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                          !notification.is_read ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <NotificationContent
                          notification={notification}
                          onMarkAsRead={handleMarkAsRead}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface NotificationContentProps {
  notification: DisplayNotification
  onMarkAsRead: (id: number, event: React.MouseEvent) => void
}

function NotificationContent({ notification, onMarkAsRead }: NotificationContentProps) {
  return (
    <div className="flex items-start gap-3">
      {/* Icon */}
      <div
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg border ${
          NOTIFICATION_COLORS[notification.type]
        }`}
      >
        {NOTIFICATION_ICONS[notification.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {notification.title}
        </p>
        <p className="text-sm text-gray-600 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {formatTimeAgo(notification.created_at)}
        </p>
      </div>

      {/* Unread indicator */}
      {!notification.is_read && (
        <button
          onClick={(e) => onMarkAsRead(notification.id, e)}
          className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
          title="Mark as read"
        />
      )}
    </div>
  )
}
