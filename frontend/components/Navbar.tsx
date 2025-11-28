'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { UserResponse, messagesAPI, authAPI } from '@/lib/api'
import NotificationDropdown from './NotificationDropdown'
import StarRating from './StarRating'
import { useWebSocketContext } from '@/contexts/WebSocketContext'
import { Badge, ConnectionStatus } from '@/components/ui'

interface NavbarProps {
  user: UserResponse | null
}

export default function Navbar({ user }: NavbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [unreadMessageCount, setUnreadMessageCount] = useState(0)

  // Get shared WebSocket context
  const { onMessageReceived, connectionStatus } = useWebSocketContext()

  // Subscribe to message events
  useEffect(() => {
    const unsubscribe = onMessageReceived(() => {
      // Only increment if not currently on the messages page
      if (!pathname?.startsWith('/messages')) {
        setUnreadMessageCount(prev => prev + 1)
      }
    })
    return unsubscribe
  }, [onMessageReceived, pathname])

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

  const handleLogout = async () => {
    try {
      await authAPI.logout()
    } catch (err) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', err)
    }
    router.push('/')
  }

  const isSender = user?.role === 'sender' || user?.role === 'both' || user?.role === 'admin'
  const isCourier = user?.role === 'courier' || user?.role === 'both'
  const isAdmin = user?.role === 'admin'

  const isActiveLink = (path: string) => pathname === path

  return (
    <nav className="bg-white border-b border-surface-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Desktop Nav */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <span className="text-2xl font-bold text-gradient">Chaski</span>
            </Link>

            {/* Desktop Navigation Links */}
            {user && (
              <div className="hidden md:flex md:ml-10 md:space-x-1">
                <Link
                  href="/dashboard"
                  className={`nav-link ${isActiveLink('/dashboard') ? 'nav-link-active' : ''}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Dashboard
                </Link>
                {isSender && (
                  <>
                    <Link
                      href="/sender"
                      className={`nav-link ${isActiveLink('/sender') ? 'nav-link-active' : ''}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      My Packages
                    </Link>
                    <Link
                      href="/packages/create"
                      className={`nav-link ${isActiveLink('/packages/create') ? 'nav-link-active' : ''}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Send Package
                    </Link>
                  </>
                )}
                {isCourier && (
                  <Link
                    href="/courier"
                    className={`nav-link ${isActiveLink('/courier') ? 'nav-link-active' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Courier
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`nav-link ${isActiveLink('/admin') ? 'nav-link-active' : ''}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Right side - Notifications and User */}
          <div className="flex items-center gap-2">
            {user && (
              <>
                {/* Connection Status Indicator */}
                <ConnectionStatus
                  status={connectionStatus}
                  size="sm"
                  className="hidden sm:flex"
                  data-testid="connection-status"
                />

                {/* Messages Link */}
                <Link
                  href="/messages"
                  className="relative p-2 text-surface-500 hover:text-surface-900 hover:bg-surface-100 rounded-lg transition-colors"
                  aria-label={`Messages${unreadMessageCount > 0 ? ` (${unreadMessageCount} unread)` : ''}`}
                >
                  <svg
                    className="h-5 w-5"
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
                    <span
                      className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-primary-600 rounded-full"
                      data-testid="message-unread-count"
                    >
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </span>
                  )}
                </Link>

                {/* Notification Dropdown */}
                <NotificationDropdown />

                {/* User Dropdown Menu - Hidden on mobile */}
                <div className="hidden sm:block relative" data-testid="user-menu-button">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-100 transition-colors"
                  >
                    <div className="avatar-sm bg-primary-600 text-white">
                      {user.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-surface-900">
                        {user.full_name}
                      </span>
                      <div className="flex items-center gap-1">
                        <StarRating rating={user.average_rating || 0} size="sm" />
                        <span className="text-xs text-surface-400">
                          ({user.total_ratings || 0})
                        </span>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setUserMenuOpen(false)}
                      />
                      <div className="dropdown-menu right-0 mt-2 w-56 z-20">
                        {/* User Info Header */}
                        <div className="px-4 py-3 border-b border-surface-100">
                          <p className="text-sm font-medium text-surface-900">{user.full_name}</p>
                          <p className="text-xs text-surface-500 truncate">{user.email}</p>
                          <Badge variant="primary" size="sm" className="mt-1.5 capitalize">
                            {user.role}
                          </Badge>
                        </div>

                        {/* Menu Items */}
                        <div className="py-1">
                          <Link
                            href="/profile/reviews"
                            className="dropdown-item"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            My Reviews
                          </Link>
                          <Link
                            href="/notifications"
                            className="dropdown-item"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            Notifications
                          </Link>
                          <Link
                            href="/messages"
                            className="dropdown-item"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            Messages
                            {unreadMessageCount > 0 && (
                              <span className="ml-auto">
                                <Badge variant="primary" size="sm">
                                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                                </Badge>
                              </span>
                            )}
                          </Link>
                        </div>

                        {/* Logout */}
                        <div className="dropdown-divider" />
                        <div className="py-1">
                          <button
                            onClick={() => {
                              setUserMenuOpen(false)
                              handleLogout()
                            }}
                            className="dropdown-item-danger w-full text-left"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Logout
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
                  aria-label="Toggle menu"
                  data-testid="mobile-menu-button"
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
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="btn-ghost"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="btn-primary"
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
        <div className="md:hidden border-t border-surface-200 animate-fade-in" data-testid="mobile-nav">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/dashboard"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium ${isActiveLink('/dashboard') ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-100'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>
            <Link
              href="/messages"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium ${pathname?.startsWith('/messages') ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-100'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Messages
              {unreadMessageCount > 0 && (
                <Badge variant="primary" size="sm">
                  {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                </Badge>
              )}
            </Link>
            {isSender && (
              <>
                <Link
                  href="/sender"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium ${isActiveLink('/sender') ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-100'}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  My Packages
                </Link>
                <Link
                  href="/packages/create"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium ${isActiveLink('/packages/create') ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-100'}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Send Package
                </Link>
              </>
            )}
            {isCourier && (
              <Link
                href="/courier"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium ${isActiveLink('/courier') ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-100'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Courier
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium ${isActiveLink('/admin') ? 'bg-primary-50 text-primary-700' : 'text-surface-600 hover:bg-surface-100'}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
              </Link>
            )}
          </div>
          <div className="pt-4 pb-3 border-t border-surface-200">
            <div className="px-4 py-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-surface-900">{user.full_name}</p>
                <Link
                  href="/profile/reviews"
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <StarRating rating={user.average_rating || 0} size="sm" />
                  <span className="text-xs text-surface-400">({user.total_ratings || 0})</span>
                </Link>
              </div>
              <p className="text-sm text-surface-500">{user.email}</p>
            </div>
            <div className="px-2 mt-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-base font-medium text-error-600 hover:bg-error-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
