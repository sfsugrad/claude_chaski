'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { UserResponse, messagesAPI } from '@/lib/api'
import NotificationDropdown from './NotificationDropdown'
import StarRating from './StarRating'
import { useWebSocket } from '@/hooks/useWebSocket'

interface NavbarProps {
  user: UserResponse | null
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)

  // Handle incoming WebSocket messages
  const handleMessageReceived = useCallback(() => {
    // Only increment if not currently on the messages page
    if (!pathname?.startsWith('/messages')) {
      setUnreadMessageCount(prev => prev + 1)
    }
  }, [pathname])

  // Connect to WebSocket for real-time message notifications
  useWebSocket({
    onMessageReceived: handleMessageReceived,
  })

  // Fetch unread message count
  useEffect(() => {
    if (!user) return

    const fetchUnreadCount = async () => {
      try {
        const response = await messagesAPI.getUnreadCount()
        setUnreadMessageCount(response.data.unread_count)
      } catch (err) {
        // Silently fail - not critical
        console.error('Failed to fetch message count:', err)
      }
    }

    fetchUnreadCount()
    // Poll every 30 seconds as fallback
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [user, pathname]) // Re-fetch when navigating away from messages page

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/')
  }

  const isSender = user?.role === 'sender' || user?.role === 'both' || user?.role === 'admin'
  const isCourier = user?.role === 'courier' || user?.role === 'both'
  const isAdmin = user?.role === 'admin'

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Desktop Nav */}
          <div className="flex items-center">
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              Chaski
            </Link>

            {/* Desktop Navigation Links */}
            {user && (
              <div className="hidden md:flex md:ml-10 md:space-x-4">
                <Link
                  href="/dashboard"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  Dashboard
                </Link>
                {isSender && (
                  <>
                    <Link
                      href="/sender"
                      className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    >
                      My Packages
                    </Link>
                    <Link
                      href="/packages/create"
                      className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    >
                      Send Package
                    </Link>
                  </>
                )}
                {isCourier && (
                  <Link
                    href="/courier"
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    Courier
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    Admin
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Right side - Notifications and User */}
          <div className="flex items-center space-x-4">
            {user && (
              <>
                {/* Messages Link */}
                <Link
                  href="/messages"
                  className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label={`Messages${unreadMessageCount > 0 ? ` (${unreadMessageCount} unread)` : ''}`}
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
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  {unreadMessageCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white bg-blue-600 rounded-full">
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </span>
                  )}
                </Link>

                {/* Notification Dropdown */}
                <NotificationDropdown />

                {/* User Info with Rating - Hidden on mobile */}
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    {user.full_name}
                  </span>
                  <Link
                    href="/profile/reviews"
                    className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                    title="View my reviews"
                  >
                    <StarRating rating={user.average_rating || 0} size="sm" />
                    <span className="text-xs text-gray-500">
                      ({user.total_ratings || 0})
                    </span>
                  </Link>
                </div>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="hidden sm:block px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  aria-label="Toggle menu"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </>
            )}

            {!user && (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/dashboard"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/messages"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Messages
              {unreadMessageCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </span>
              )}
            </Link>
            {isSender && (
              <>
                <Link
                  href="/sender"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  My Packages
                </Link>
                <Link
                  href="/packages/create"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Send Package
                </Link>
              </>
            )}
            {isCourier && (
              <Link
                href="/courier"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                Courier
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin
              </Link>
            )}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="px-4 py-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                <Link
                  href="/profile/reviews"
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <StarRating rating={user.average_rating || 0} size="sm" />
                  <span className="text-xs text-gray-500">({user.total_ratings || 0})</span>
                </Link>
              </div>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <div className="px-2 mt-2">
              <button
                onClick={handleLogout}
                className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
