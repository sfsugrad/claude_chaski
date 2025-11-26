'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from '@/lib/api'

interface User {
  id: number
  email: string
  full_name: string
  role: 'SENDER' | 'COURIER' | 'BOTH' | 'ADMIN'
  is_verified: boolean
  is_active: boolean
  created_at: string
}

interface Package {
  id: number
  sender_id: number
  pickup_location: string
  dropoff_location: string
  status: string
  price: number
  created_at: string
}

interface Stats {
  total_users: number
  total_senders: number
  total_couriers: number
  total_both: number
  total_admins: number
  total_packages: number
  active_packages: number
  completed_packages: number
  pending_packages: number
  total_revenue: number
}

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [packages, setPackages] = useState<Package[]>([])
  const [stats, setStats] = useState<Stats>({
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
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'packages'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await axios.get('/auth/me')
      const currentUser = response.data

      if (currentUser.role !== 'ADMIN' && currentUser.role !== 'admin') {
        setError('Access denied. Admin privileges required.')
        setTimeout(() => router.push('/'), 3000)
        return
      }

      setUser(currentUser)
      await loadData()
    } catch (err) {
      console.error('Auth error:', err)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const loadData = async () => {
    // Load users
    try {
      const usersResponse = await axios.get('/admin/users')
      setUsers(usersResponse.data)
    } catch (err) {
      console.error('Error loading users:', err)
    }

    // Load packages
    try {
      const packagesResponse = await axios.get('/admin/packages')
      setPackages(packagesResponse.data)
    } catch (err) {
      console.error('Error loading packages:', err)
    }

    // Load stats from backend
    try {
      const statsResponse = await axios.get('/admin/stats')
      setStats(statsResponse.data)
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await axios.put(`/admin/users/${userId}`, { role: newRole })
      await loadData()
      alert('User role updated successfully')
    } catch (err) {
      console.error('Error updating role:', err)
      alert('Failed to update user role')
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return
    }

    try {
      await axios.delete(`/admin/users/${userId}`)
      await loadData()
      alert('User deleted successfully')
    } catch (err) {
      console.error('Error deleting user:', err)
      alert('Failed to delete user')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error}</div>
          <div className="text-gray-600">Redirecting...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-purple-600 text-white shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Chaski Admin Dashboard</h1>
            <div className="flex items-center gap-4">
              <span className="text-purple-100">
                {user?.full_name} ({user?.email})
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem('token')
                  router.push('/login')
                }}
                className="bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-2 border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-purple-600 text-purple-600 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-purple-600'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-2 border-b-2 transition ${
                activeTab === 'users'
                  ? 'border-purple-600 text-purple-600 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-purple-600'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('packages')}
              className={`py-4 px-2 border-b-2 transition ${
                activeTab === 'packages'
                  ? 'border-purple-600 text-purple-600 font-semibold'
                  : 'border-transparent text-gray-600 hover:text-purple-600'
              }`}
            >
              Packages
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Platform Overview</h2>

            {/* Stats Cards */}
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm mb-2">Total Users</div>
                <div className="text-3xl font-bold text-purple-600">
                  {stats.total_users}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm mb-2">Senders Only</div>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.total_senders}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm mb-2">Couriers Only</div>
                <div className="text-3xl font-bold text-green-600">
                  {stats.total_couriers}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm mb-2">Both Roles</div>
                <div className="text-3xl font-bold text-teal-600">
                  {stats.total_both}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm mb-2">Admins</div>
                <div className="text-3xl font-bold text-red-600">
                  {stats.total_admins}
                </div>
              </div>
            </div>

            {/* Package Stats */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm mb-2">Total Packages</div>
                <div className="text-3xl font-bold text-orange-600">
                  {stats.total_packages}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm mb-2">Active Packages</div>
                <div className="text-3xl font-bold text-yellow-600">
                  {stats.active_packages}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm mb-2">Completed</div>
                <div className="text-3xl font-bold text-green-600">
                  {stats.completed_packages}
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-gray-600 text-sm mb-2">Total Revenue</div>
                <div className="text-3xl font-bold text-purple-600">
                  ${stats.total_revenue.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <button
                  onClick={() => setActiveTab('users')}
                  className="bg-purple-600 text-white px-6 py-3 rounded hover:bg-purple-700 transition"
                >
                  Manage Users
                </button>
                <button
                  onClick={() => setActiveTab('packages')}
                  className="bg-purple-600 text-white px-6 py-3 rounded hover:bg-purple-700 transition"
                >
                  View Packages
                </button>
                <button
                  className="bg-gray-600 text-white px-6 py-3 rounded hover:bg-gray-700 transition"
                  disabled
                >
                  Generate Reports (Coming Soon)
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">User Management</h2>
              <div className="text-gray-600">
                Total Users: {users.length}
              </div>
            </div>

            {users.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-600 mb-4">
                  Admin API endpoints not yet implemented
                </div>
                <div className="text-sm text-gray-500">
                  User management features will be available once backend admin routes are created
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Joined
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {u.full_name}
                          </div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="text-sm border rounded px-2 py-1"
                          >
                            <option value="sender">Sender</option>
                            <option value="courier">Courier</option>
                            <option value="both">Both</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              u.is_verified
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {u.is_verified ? 'Verified' : 'Unverified'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'packages' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Package Management</h2>
              <div className="flex items-center gap-4">
                <div className="text-gray-600">
                  Total Packages: {packages.length}
                </div>
                <button
                  onClick={() => router.push('/packages/create')}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
                >
                  + Create Package
                </button>
              </div>
            </div>

            {packages.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-600 mb-4">
                  Admin API endpoints not yet implemented
                </div>
                <div className="text-sm text-gray-500">
                  Package management features will be available once backend admin routes are created
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Package ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Route
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
                      <tr key={pkg.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{pkg.id}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div>{pkg.pickup_location}</div>
                          <div className="text-gray-400">↓</div>
                          <div>{pkg.dropoff_location}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {pkg.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${pkg.price}
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
        )}
      </div>
    </div>
  )
}
