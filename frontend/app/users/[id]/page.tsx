'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { authAPI, adminAPI, AdminUser, AdminPackage } from '@/lib/api'

type User = AdminUser

interface Package {
  id: number
  description: string
  status: string
  created_at: string
}

export default function UserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<User | null>(null)
  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadUserData()
  }, [userId])

  const loadUserData = async () => {
    try {
      // Get current user to verify admin
      const currentUserResponse = await authAPI.getCurrentUser()
      if (currentUserResponse.data.role !== 'admin' && currentUserResponse.data.role !== 'ADMIN') {
        setError('Access denied. Admin privileges required.')
        setLoading(false)
        return
      }

      // Get user details
      const userResponse = await adminAPI.getUser(parseInt(userId))
      setUser(userResponse.data)

      // Get user's packages
      try {
        const packagesResponse = await adminAPI.getPackages()
        const userPackages = packagesResponse.data.filter(
          (pkg: AdminPackage) => pkg.sender_id === parseInt(userId)
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

  const getStatusColor = (status: string) => {
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
                User Details
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* User Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Personal Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="text-gray-900 mt-1 font-medium">{user.full_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-gray-900 mt-1">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Phone Number</label>
                <p className="text-gray-900 mt-1">{user.phone_number || 'Not provided'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">User ID</label>
                  <p className="text-gray-900 mt-1 font-mono">#{user.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Max Deviation</label>
                  <p className="text-gray-900 mt-1">{user.max_deviation_km} km</p>
                </div>
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Account Status
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Role</label>
                  <p className="text-gray-900 mt-1">
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                      {user.role.toUpperCase()}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Active Status</label>
                  <p className="text-gray-900 mt-1">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Verification Status</label>
                <p className="text-gray-900 mt-1">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    user.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {user.is_verified ? 'Verified' : 'Unverified'}
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-gray-900 mt-1 text-sm">
                    {new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-gray-900 mt-1 text-sm">
                    {user.updated_at
                      ? new Date(user.updated_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Packages */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            Packages ({packages.length})
          </h2>
          {packages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No packages found for this user</p>
          ) : (
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
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {packages.map((pkg) => (
                    <tr key={pkg.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/packages/${pkg.id}`}
                          className="text-purple-600 hover:text-purple-800 font-medium"
                        >
                          #{pkg.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900 truncate max-w-md">
                          {pkg.description}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(pkg.status)}`}>
                          {pkg.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(pkg.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
