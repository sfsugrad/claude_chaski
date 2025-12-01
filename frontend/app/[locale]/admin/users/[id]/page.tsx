'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { authAPI, adminAPI, AdminUser, AdminPackage, UserResponse } from '@/lib/api'

type User = AdminUser

interface Package {
  id: number
  description: string
  size: string
  status: string
  price: number
  created_at: string
}

export default function UserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const locale = useLocale()
  const userId = params.id as string

  // Map locale to country code for phone input
  const getDefaultCountry = (locale: string) => {
    const countryMap: { [key: string]: string } = {
      'en': 'US',
      'fr': 'FR',
      'es': 'ES'
    }
    return countryMap[locale] || 'US'
  }

  const [user, setUser] = useState<User | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [currentUser, setCurrentUser] = useState<UserResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [editedUser, setEditedUser] = useState<Partial<User>>({})

  useEffect(() => {
    loadUserData()
  }, [userId])

  const loadUserData = async () => {
    try {
      // Get current user
      const currentUserResponse = await authAPI.getCurrentUser()
      setCurrentUser(currentUserResponse.data)

      // Check if current user is admin
      if (currentUserResponse.data.role !== 'admin' && currentUserResponse.data.role !== 'ADMIN') {
        setError('Access denied. Admin privileges required.')
        return
      }

      // Get user details
      const userResponse = await adminAPI.getUser(parseInt(userId))
      setUser(userResponse.data)

      // Get user's packages
      try {
        const packagesResponse = await adminAPI.getPackages()
        const allPackages = packagesResponse.data
        const userPackages = allPackages.filter(
          (pkg: AdminPackage) => pkg.sender_id === parseInt(userId) || pkg.courier_id === parseInt(userId)
        )
        setPackages(userPackages)
      } catch (err) {
        console.error('Error loading packages:', err)
      }
    } catch (err: any) {
      console.error('Error loading user:', err)
      if (err.response?.status === 404) {
        setError('User not found')
      } else if (err.response?.status === 403) {
        setError('Access denied. Admin privileges required.')
      } else {
        setError('Failed to load user details')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    if (user) {
      setEditedUser({
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
        max_deviation_km: user.max_deviation_km,
        is_active: user.is_active,
        is_verified: user.is_verified,
        phone_verified: user.phone_verified,
        id_verified: user.id_verified
      })
      setIsEditing(true)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedUser({})
  }

  const handleSave = async () => {
    if (!user || !editedUser) return

    try {
      // Update role if changed
      if (editedUser.role && editedUser.role !== user.role) {
        // Check if trying to change own role
        if (parseInt(userId) === currentUser?.id) {
          alert('You cannot change your own role')
          return
        }
        // Validate role transition is allowed
        const allowedRoles = getAllowedRoles(user.role)
        if (!allowedRoles.includes(editedUser.role.toLowerCase())) {
          alert(`Role transition from ${user.role} to ${editedUser.role} is not allowed.\n\n${getRoleTransitionHelp(user.role)}`)
          return
        }
        await adminAPI.updateUserRole(parseInt(userId), editedUser.role)
      }

      // Update active status if changed
      if (editedUser.is_active !== undefined && editedUser.is_active !== user.is_active) {
        // Check if trying to deactivate self
        if (parseInt(userId) === currentUser?.id && !editedUser.is_active) {
          alert('You cannot deactivate your own account')
          return
        }
        await adminAPI.toggleUserActive(parseInt(userId), editedUser.is_active)
      }

      // Update verified status if changed
      if (editedUser.is_verified !== undefined && editedUser.is_verified !== user.is_verified) {
        await adminAPI.toggleUserVerified(parseInt(userId), editedUser.is_verified)
      }

      // Update phone verified status if changed
      if (editedUser.phone_verified !== undefined && editedUser.phone_verified !== user.phone_verified) {
        await adminAPI.toggleUserPhoneVerified(parseInt(userId), editedUser.phone_verified)
      }

      // Update ID verified status if changed
      if (editedUser.id_verified !== undefined && editedUser.id_verified !== user.id_verified) {
        await adminAPI.toggleUserIdVerified(parseInt(userId), editedUser.id_verified)
      }

      // Update profile (full_name, email, phone_number, and max_deviation_km) if changed
      const profileChanged =
        (editedUser.full_name !== undefined && editedUser.full_name !== user.full_name) ||
        (editedUser.email !== undefined && editedUser.email !== user.email) ||
        (editedUser.phone_number !== undefined && editedUser.phone_number !== user.phone_number) ||
        (editedUser.max_deviation_km !== undefined && editedUser.max_deviation_km !== user.max_deviation_km)

      if (profileChanged) {
        const profileData: { full_name?: string; email?: string; phone_number?: string | null; max_deviation_km?: number } = {}
        if (editedUser.full_name !== undefined && editedUser.full_name !== user.full_name) {
          profileData.full_name = editedUser.full_name
        }
        if (editedUser.email !== undefined && editedUser.email !== user.email) {
          profileData.email = editedUser.email
        }
        if (editedUser.phone_number !== undefined && editedUser.phone_number !== user.phone_number) {
          profileData.phone_number = editedUser.phone_number
        }
        if (editedUser.max_deviation_km !== undefined && editedUser.max_deviation_km !== user.max_deviation_km) {
          profileData.max_deviation_km = editedUser.max_deviation_km
        }
        await adminAPI.updateUserProfile(parseInt(userId), profileData)
      }

      alert('User updated successfully')
      setIsEditing(false)
      await loadUserData()
    } catch (err: any) {
      console.error('Error updating user:', err)
      const detail = err.response?.data?.detail
      let errorMessage = 'Failed to update user'
      if (detail) {
        if (typeof detail === 'string') {
          errorMessage = detail
        } else if (detail.message) {
          // Handle structured error responses (e.g., active packages blocking deactivation)
          errorMessage = detail.message
          if (detail.packages_as_sender?.length || detail.packages_as_courier?.length) {
            const senderIds = detail.packages_as_sender?.join(', ') || ''
            const courierIds = detail.packages_as_courier?.join(', ') || ''
            if (senderIds) errorMessage += `\n\nPackages as sender: #${senderIds}`
            if (courierIds) errorMessage += `\n\nPackages as courier: #${courierIds}`
          }
        }
      }
      alert(errorMessage)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    const roleUpper = role.toUpperCase()
    switch (roleUpper) {
      case 'ADMIN':
        return 'bg-red-100 text-red-800'
      case 'SENDER':
        return 'bg-blue-100 text-blue-800'
      case 'COURIER':
        return 'bg-green-100 text-green-800'
      case 'BOTH':
        return 'bg-teal-100 text-teal-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    const statusLower = status.toLowerCase()
    switch (statusLower) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'matched':
        return 'bg-blue-100 text-blue-800'
      case 'picked_up':
        return 'bg-purple-100 text-purple-800'
      case 'in_transit':
        return 'bg-indigo-100 text-indigo-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const canEditRole = () => {
    return user && currentUser && user.id !== currentUser.id
  }

  const canEditActiveStatus = () => {
    return user && currentUser && user.id !== currentUser.id
  }

  // Get allowed role transitions based on current role
  // Only 4 transitions are allowed:
  // - sender → both
  // - courier → both
  // - both → admin
  // - admin → both
  const getAllowedRoles = (currentRole: string): string[] => {
    const role = currentRole.toLowerCase()
    switch (role) {
      case 'sender':
        return ['sender', 'both']  // Can only upgrade to both
      case 'courier':
        return ['courier', 'both']  // Can only upgrade to both
      case 'both':
        return ['both', 'admin']  // Can only promote to admin
      case 'admin':
        return ['admin', 'both']  // Can only demote to both
      default:
        return [role]
    }
  }

  const getRoleTransitionHelp = (currentRole: string): string => {
    const role = currentRole.toLowerCase()
    switch (role) {
      case 'sender':
        return 'Senders can only be upgraded to "Both" role'
      case 'courier':
        return 'Couriers can only be upgraded to "Both" role'
      case 'both':
        return 'Users with "Both" role can only be promoted to Admin'
      case 'admin':
        return 'Admins can only be demoted to "Both" role'
      default:
        return ''
    }
  }

  const isRoleDisabled = (targetRole: string): boolean => {
    if (!user) return true
    const allowedRoles = getAllowedRoles(user.role)
    return !allowedRoles.includes(targetRole.toLowerCase())
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading user details...</div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error || 'User not found'}</div>
          <Link
            href="/admin"
            className="text-purple-600 hover:text-purple-700 underline"
          >
            Return to Admin Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="text-purple-600 hover:text-purple-700"
              >
                ← Back to Admin
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                {user.full_name}
              </h1>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                {user.role.toUpperCase()}
              </span>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="flex gap-2">
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Edit User
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Account Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Account Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">User ID</label>
                <p className="text-gray-900 mt-1 font-mono">#{user.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email Address</label>
                {isEditing ? (
                  <>
                    <input
                      type="email"
                      value={editedUser.email || ''}
                      onChange={(e) => setEditedUser({ ...editedUser, email: e.target.value })}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter email address"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Changing email will reset email verification status
                    </p>
                  </>
                ) : (
                  <p className="text-gray-900 mt-1">{user.email}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedUser.full_name || ''}
                    onChange={(e) => setEditedUser({ ...editedUser, full_name: e.target.value })}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter full name"
                    required
                  />
                ) : (
                  <p className="text-gray-900 mt-1">{user.full_name}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone Number</label>
                {isEditing ? (
                  <PhoneInput
                    international
                    defaultCountry="US"
                    countries={['US']}
                    value={editedUser.phone_number || ''}
                    onChange={(value) => setEditedUser({ ...editedUser, phone_number: value || '' })}
                    className="mt-1 phone-input"
                  />
                ) : (
                  <p className="text-gray-900 mt-1">{user.phone_number || 'Not provided'}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Role</label>
                {isEditing ? (
                  <>
                    <select
                      value={editedUser.role || user.role}
                      onChange={(e) => setEditedUser({ ...editedUser, role: e.target.value })}
                      className={`mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        !canEditRole() ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                      disabled={!canEditRole()}
                      title={!canEditRole() ? 'You cannot change your own role' : ''}
                    >
                      {getAllowedRoles(user.role).map((role) => (
                        <option key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                      ))}
                    </select>
                    {!canEditRole() ? (
                      <p className="text-xs text-red-500 mt-1">You cannot change your own role</p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        {getRoleTransitionHelp(user.role)}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="mt-1">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                      {user.role.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Account Status
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Active Status</label>
                {isEditing ? (
                  <>
                    <div className="mt-1 flex items-center gap-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="is_active"
                          checked={editedUser.is_active === true}
                          onChange={() => setEditedUser({ ...editedUser, is_active: true })}
                          disabled={!canEditActiveStatus()}
                          className="focus:ring-purple-500"
                        />
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 ${
                          !canEditActiveStatus() ? 'opacity-50' : ''
                        }`}>
                          Active
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="is_active"
                          checked={editedUser.is_active === false}
                          onChange={() => setEditedUser({ ...editedUser, is_active: false })}
                          disabled={!canEditActiveStatus()}
                          className="focus:ring-purple-500"
                        />
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 ${
                          !canEditActiveStatus() ? 'opacity-50' : ''
                        }`}>
                          Inactive
                        </span>
                      </label>
                    </div>
                    {!canEditActiveStatus() && (
                      <p className="text-xs text-red-500 mt-1">You cannot deactivate your own account</p>
                    )}
                  </>
                ) : (
                  <div className="mt-1">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email Verification</label>
                {isEditing ? (
                  <>
                    <div className="mt-1 flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="is_verified"
                          checked={editedUser.is_verified === true}
                          onChange={() => setEditedUser({ ...editedUser, is_verified: true })}
                          className="focus:ring-purple-500"
                        />
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Verified
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="is_verified"
                          checked={editedUser.is_verified === false}
                          onChange={() => setEditedUser({ ...editedUser, is_verified: false })}
                          className="focus:ring-purple-500"
                        />
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Unverified
                        </span>
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="mt-1">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      user.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone Verification</label>
                {isEditing ? (
                  <>
                    <div className="mt-1 flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="phone_verified"
                          checked={editedUser.phone_verified === true}
                          onChange={() => setEditedUser({ ...editedUser, phone_verified: true })}
                          className="focus:ring-purple-500"
                        />
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Verified
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="phone_verified"
                          checked={editedUser.phone_verified === false}
                          onChange={() => setEditedUser({ ...editedUser, phone_verified: false })}
                          className="focus:ring-purple-500"
                        />
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Unverified
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Phone: {user.phone_number || 'Not provided'}
                    </p>
                  </>
                ) : (
                  <div className="mt-1">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      user.phone_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.phone_verified ? 'Verified' : 'Unverified'}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      ({user.phone_number || 'No phone'})
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ID Verification</label>
                {isEditing ? (
                  <>
                    <div className="mt-1 flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="id_verified"
                          checked={editedUser.id_verified === true}
                          onChange={() => setEditedUser({ ...editedUser, id_verified: true })}
                          className="focus:ring-purple-500"
                        />
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Verified
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="id_verified"
                          checked={editedUser.id_verified === false}
                          onChange={() => setEditedUser({ ...editedUser, id_verified: false })}
                          className="focus:ring-purple-500"
                        />
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Unverified
                        </span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Required for couriers to place bids and access full features
                    </p>
                  </>
                ) : (
                  <div className="mt-1">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      user.id_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.id_verified ? 'Verified' : 'Unverified'}
                    </span>
                    <span className="ml-2 text-sm text-gray-500">
                      (Stripe Identity)
                    </span>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Account Created</label>
                <p className="text-gray-900 mt-1">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              {user.updated_at && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-gray-900 mt-1">
                    {new Date(user.updated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Preferences
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Max Route Deviation</label>
                {isEditing ? (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={editedUser.max_deviation_km || ''}
                        onChange={(e) => setEditedUser({ ...editedUser, max_deviation_km: parseInt(e.target.value) || 5 })}
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="5"
                      />
                      <span className="text-gray-600 mt-1">km</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Range: 1-500 km. Maximum distance from planned route for package matching.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-900 mt-1 text-lg font-semibold">
                      {user.max_deviation_km} km
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      Maximum distance from planned route for package matching
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Activity Statistics
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Total Packages</label>
                <p className="text-gray-900 mt-1 text-2xl font-bold">{packages.length}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Delivered Packages</label>
                <p className="text-gray-900 mt-1 text-2xl font-bold">
                  {packages.filter(p => p.status.toLowerCase() === 'delivered').length}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Active Packages</label>
                <p className="text-gray-900 mt-1 text-2xl font-bold">
                  {packages.filter(p => ['pending', 'matched', 'in_transit', 'picked_up'].includes(p.status.toLowerCase())).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Packages Section */}
        {packages.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Related Packages ({packages.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Package ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/packages/${pkg.tracking_id}`}
                          className="text-purple-600 hover:text-purple-700 font-semibold"
                        >
                          {pkg.tracking_id}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate">{pkg.description}</div>
                        <div className="text-xs text-gray-500">{pkg.size}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(pkg.status)}`}>
                          {pkg.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${pkg.price?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(pkg.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {packages.length === 0 && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">This user has no packages yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
