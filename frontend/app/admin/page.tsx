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
  description: string
  size: string
  weight_kg: number
  pickup_address: string
  dropoff_address: string
  status: string
  price: number
  is_active: boolean
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
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all')
  const [userVerificationFilter, setUserVerificationFilter] = useState<string>('all')
  const [userActiveFilter, setUserActiveFilter] = useState<string>('all')
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'sender',
    phone_number: '',
    max_deviation_km: 5
  })

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

  const handleToggleUserActive = async (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
      return
    }

    try {
      await axios.put(`/admin/users/${userId}/toggle-active`, {
        is_active: !currentStatus
      })
      await loadData()
      alert(`User ${action}d successfully`)
    } catch (err: any) {
      console.error('Error toggling user status:', err)
      const errorMessage = err.response?.data?.detail || `Failed to ${action} user`
      alert(errorMessage)
    }
  }

  const handleTogglePackageActive = async (packageId: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${action} this package?`)) {
      return
    }

    try {
      await axios.put(`/admin/packages/${packageId}/toggle-active`, {
        is_active: !currentStatus
      })
      await loadData()
      alert(`Package ${action}d successfully`)
    } catch (err: any) {
      console.error('Error toggling package status:', err)
      const errorMessage = err.response?.data?.detail || `Failed to ${action} package`
      alert(errorMessage)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post('/admin/users', newUserData)
      await loadData()
      setShowCreateUserModal(false)
      setNewUserData({
        email: '',
        password: '',
        full_name: '',
        role: 'sender',
        phone_number: '',
        max_deviation_km: 5
      })
      alert('User created successfully')
    } catch (err: any) {
      console.error('Error creating user:', err)
      const errorMessage = err.response?.data?.detail || 'Failed to create user'
      alert(errorMessage)
    }
  }

  const getFilteredUsers = () => {
    let filtered = users

    // Filter by role
    if (userRoleFilter !== 'all') {
      filtered = filtered.filter(u => u.role.toLowerCase() === userRoleFilter.toLowerCase())
    }

    // Filter by verification status
    if (userVerificationFilter === 'verified') {
      filtered = filtered.filter(u => u.is_verified)
    } else if (userVerificationFilter === 'unverified') {
      filtered = filtered.filter(u => !u.is_verified)
    }

    // Filter by active status
    if (userActiveFilter === 'active') {
      filtered = filtered.filter(u => u.is_active)
    } else if (userActiveFilter === 'inactive') {
      filtered = filtered.filter(u => !u.is_active)
    }

    return filtered
  }

  const getFilteredPackages = () => {
    let filtered = packages

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(pkg => pkg.status.toLowerCase() === statusFilter.toLowerCase())
    }

    // Filter by active/inactive
    if (activeFilter === 'active') {
      filtered = filtered.filter(pkg => pkg.is_active)
    } else if (activeFilter === 'inactive') {
      filtered = filtered.filter(pkg => !pkg.is_active)
    }

    return filtered
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
              <div className="flex items-center gap-4">
                <div className="text-gray-600">
                  Total Users: {users.length}
                </div>
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
                >
                  + Create User
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Role:</label>
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Roles</option>
                    <option value="sender">Sender</option>
                    <option value="courier">Courier</option>
                    <option value="both">Both</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Verification:</label>
                  <select
                    value={userVerificationFilter}
                    onChange={(e) => setUserVerificationFilter(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Users</option>
                    <option value="verified">Verified Only</option>
                    <option value="unverified">Unverified Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Status:</label>
                  <select
                    value={userActiveFilter}
                    onChange={(e) => setUserActiveFilter(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Users</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>

                <div className="text-sm text-gray-600 ml-auto">
                  Showing {getFilteredUsers().length} of {users.length} users
                </div>
              </div>
            </div>

            {getFilteredUsers().length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-600 mb-4">
                  {users.length === 0
                    ? 'No users found'
                    : 'No users match the selected filters'}
                </div>
                {users.length > 0 && (
                  <button
                    onClick={() => {
                      setUserRoleFilter('all')
                      setUserVerificationFilter('all')
                      setUserActiveFilter('all')
                    }}
                    className="text-purple-600 hover:text-purple-700 text-sm underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : users.length === 0 ? (
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
                        Verification
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Active
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
                    {getFilteredUsers().map((u) => (
                      <tr key={u.id} className={!u.is_active ? 'bg-gray-50 opacity-60' : ''}>
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
                            disabled={!u.is_active}
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            u.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {u.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {u.is_active ? (
                            <button
                              onClick={() => handleToggleUserActive(u.id, u.is_active)}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleUserActive(u.id, u.is_active)}
                              className="text-green-600 hover:text-green-900 font-medium"
                            >
                              Activate
                            </button>
                          )}
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

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Status:</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="matched">Matched</option>
                    <option value="picked_up">Picked Up</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Active Status:</label>
                  <select
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Packages</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>

                <div className="text-sm text-gray-600 ml-auto">
                  Showing {getFilteredPackages().length} of {packages.length} packages
                </div>
              </div>
            </div>

            {getFilteredPackages().length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-600 mb-4">
                  {packages.length === 0
                    ? 'No packages found'
                    : 'No packages match the selected filters'}
                </div>
                {packages.length > 0 && (
                  <button
                    onClick={() => {
                      setStatusFilter('all')
                      setActiveFilter('all')
                    }}
                    className="text-purple-600 hover:text-purple-700 text-sm underline"
                  >
                    Clear filters
                  </button>
                )}
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
                        Sender
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Active
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredPackages().map((pkg) => {
                      const sender = users.find(u => u.id === pkg.sender_id)
                      return (
                        <tr key={pkg.id} className={!pkg.is_active ? 'bg-gray-50 opacity-60' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <a
                              href={`/packages/${pkg.id}`}
                              className="text-purple-600 hover:text-purple-700 font-semibold"
                            >
                              #{pkg.id}
                            </a>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="font-medium">{sender?.full_name || 'Unknown'}</div>
                            <div className="text-gray-500 text-xs">{sender?.email}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="max-w-xs truncate">{pkg.description}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {pkg.size} · {pkg.weight_kg}kg
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {pkg.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              pkg.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {pkg.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${pkg.price?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(pkg.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {pkg.is_active ? (
                              pkg.status.toLowerCase() === 'pending' ? (
                                <button
                                  onClick={() => handleTogglePackageActive(pkg.id, pkg.is_active)}
                                  className="text-red-600 hover:text-red-900 font-medium"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs" title="Only pending packages can be deactivated">
                                  Cannot deactivate
                                </span>
                              )
                            ) : (
                              <button
                                onClick={() => handleTogglePackageActive(pkg.id, pkg.is_active)}
                                className="text-green-600 hover:text-green-900 font-medium"
                              >
                                Activate
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Create New User</h3>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={newUserData.email}
                  onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newUserData.full_name}
                  onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  required
                  value={newUserData.role}
                  onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="sender">Sender</option>
                  <option value="courier">Courier</option>
                  <option value="both">Both</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={newUserData.phone_number}
                  onChange={(e) => setNewUserData({ ...newUserData, phone_number: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="+1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Deviation (km)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newUserData.max_deviation_km}
                  onChange={(e) => setNewUserData({ ...newUserData, max_deviation_km: parseInt(e.target.value) || 5 })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
