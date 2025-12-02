'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authAPI, adminAPI, AdminUser, AdminPackage, AdminStats, MatchingJobResult, UserResponse, AdminRoute, AdminRouteCreate } from '@/lib/api'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import {
  StatsCard,
  StatsGrid,
  AdminDashboardSkeleton,
  Card,
  CardBody,
  CardHeader,
  Button,
  Badge,
  Alert,
  FadeIn,
  SlideIn
} from '@/components/ui'
import { BarChart, DonutChart, LineChart } from '@/components/charts'

type User = AdminUser
type Package = AdminPackage
type Stats = AdminStats

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserResponse | null>(null)
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
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'packages' | 'routes'>('overview')
  const [routes, setRoutes] = useState<AdminRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [bidStatusFilter, setBidStatusFilter] = useState<string>('all')
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
  const [matchingJobRunning, setMatchingJobRunning] = useState(false)
  const [matchingJobResult, setMatchingJobResult] = useState<MatchingJobResult | null>(null)
  const [showCreateRouteModal, setShowCreateRouteModal] = useState(false)
  const [newRouteData, setNewRouteData] = useState<AdminRouteCreate & { trip_date: string; departure_time: string }>({
    courier_id: 0,
    start_address: '',
    start_lat: 0,
    start_lng: 0,
    end_address: '',
    end_lat: 0,
    end_lng: 0,
    max_deviation_km: 5,
    trip_date: '',
    departure_time: ''
  })
  const [createRouteError, setCreateRouteError] = useState('')
  const [createRouteLoading, setCreateRouteLoading] = useState(false)

  // Chart data computations
  const userRoleChartData = useMemo(() => [
    { name: 'Senders', value: stats.total_senders, color: '#3B82F6' },
    { name: 'Couriers', value: stats.total_couriers, color: '#10B981' },
    { name: 'Both', value: stats.total_both, color: '#8B5CF6' },
    { name: 'Admins', value: stats.total_admins, color: '#EF4444' },
  ], [stats])

  const packageStatusChartData = useMemo(() => {
    const statusCounts: Record<string, number> = {}
    packages.forEach(pkg => {
      const status = pkg.status.toLowerCase()
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    const statusColors: Record<string, string> = {
      new: '#9CA3AF',
      open_for_bids: '#F59E0B',
      bid_selected: '#3B82F6',
      pending_pickup: '#8B5CF6',
      in_transit: '#06B6D4',
      delivered: '#10B981',
      canceled: '#EF4444',
      failed: '#F97316',
    }

    return Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
      value,
      color: statusColors[name] || '#6B7280',
    }))
  }, [packages])

  const packageSizeChartData = useMemo(() => {
    const sizeCounts: Record<string, number> = {}
    packages.forEach(pkg => {
      const size = pkg.size || 'unknown'
      sizeCounts[size] = (sizeCounts[size] || 0) + 1
    })

    return Object.entries(sizeCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
      value,
    }))
  }, [packages])

  // Get list of users who can have routes assigned (courier or both role)
  const courierUsers = useMemo(() => {
    return users.filter(u =>
      u.is_active &&
      (u.role.toLowerCase() === 'courier' || u.role.toLowerCase() === 'both')
    ).sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [users])

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await authAPI.getCurrentUser()
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
    const errors: string[] = []

    // Load users
    try {
      const usersResponse = await adminAPI.getUsers()
      setUsers(usersResponse.data)
    } catch (err: any) {
      console.error('Error loading users:', err)
      errors.push(`Failed to load users: ${err.response?.data?.detail || err.message}`)
    }

    // Load packages
    try {
      const packagesResponse = await adminAPI.getPackages()
      setPackages(packagesResponse.data)
    } catch (err: any) {
      console.error('Error loading packages:', err)
      errors.push(`Failed to load packages: ${err.response?.data?.detail || err.message}`)
    }

    // Load routes
    try {
      const routesResponse = await adminAPI.getRoutes()
      setRoutes(routesResponse.data)
    } catch (err: any) {
      console.error('Error loading routes:', err)
      errors.push(`Failed to load routes: ${err.response?.data?.detail || err.message}`)
    }

    // Load stats from backend
    try {
      const statsResponse = await adminAPI.getStats()
      setStats(statsResponse.data)
    } catch (err: any) {
      console.error('Error loading stats:', err)
      errors.push(`Failed to load stats: ${err.response?.data?.detail || err.message}`)
    }

    // Show errors if any occurred
    if (errors.length > 0) {
      setError(errors.join('\n'))
      console.error('Data loading errors:', errors)
    }
  }

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await adminAPI.updateUserRole(userId, newRole)
      await loadData()
      alert('User role updated successfully')
    } catch (err: any) {
      console.error('Error updating role:', err)
      const detail = err.response?.data?.detail
      let errorMessage = 'Failed to update user role'
      if (detail) {
        if (typeof detail === 'string') {
          errorMessage = detail
        } else if (detail.message) {
          errorMessage = detail.message
          if (detail.allowed_transitions) {
            const currentRole = detail.current_role
            const allowed = detail.allowed_transitions[currentRole]
            if (allowed) {
              errorMessage += `\n\nAllowed transitions from ${currentRole}: ${allowed.join(', ')}`
            }
          }
        }
      }
      alert(errorMessage)
    }
  }

  const handleToggleUserActive = async (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
      return
    }

    try {
      await adminAPI.toggleUserActive(userId, !currentStatus)
      await loadData()
      alert(`User ${action}d successfully`)
    } catch (err: any) {
      console.error('Error toggling user status:', err)
      const detail = err.response?.data?.detail
      let errorMessage = `Failed to ${action} user`
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

  const handleToggleUserVerified = async (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? 'unverify' : 'verify'
    if (!confirm(`Are you sure you want to ${action} this user's email?`)) {
      return
    }

    try {
      await adminAPI.toggleUserVerified(userId, !currentStatus)
      await loadData()
      alert(`User email ${action === 'verify' ? 'verified' : 'unverified'} successfully`)
    } catch (err: any) {
      console.error('Error toggling user verification:', err)
      const errorMessage = err.response?.data?.detail || `Failed to ${action} user`
      alert(errorMessage)
    }
  }

  const handleTogglePhoneVerified = async (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? 'unverify' : 'verify'
    if (!confirm(`Are you sure you want to ${action} this user's phone number?`)) {
      return
    }

    try {
      await adminAPI.toggleUserPhoneVerified(userId, !currentStatus)
      await loadData()
      alert(`User phone ${action === 'verify' ? 'verified' : 'unverified'} successfully`)
    } catch (err: any) {
      console.error('Error toggling phone verification:', err)
      const errorMessage = err.response?.data?.detail || `Failed to ${action} phone`
      alert(errorMessage)
    }
  }

  const handleToggleIdVerified = async (userId: number, currentStatus: boolean) => {
    const action = currentStatus ? 'unverify' : 'verify'
    if (!confirm(`Are you sure you want to ${action} this user's ID?`)) {
      return
    }

    try {
      await adminAPI.toggleUserIdVerified(userId, !currentStatus)
      await loadData()
      alert(`User ID ${action === 'verify' ? 'verified' : 'unverified'} successfully`)
    } catch (err: any) {
      console.error('Error toggling ID verification:', err)
      const errorMessage = err.response?.data?.detail || `Failed to ${action} ID`
      alert(errorMessage)
    }
  }

  const handleTogglePackageActive = async (packageId: number, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate'
    if (!confirm(`Are you sure you want to ${action} this package?`)) {
      return
    }

    try {
      await adminAPI.togglePackageActive(packageId, !currentStatus)
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
      await adminAPI.createUser(newUserData)
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

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateRouteError('')

    // Validate form
    if (!newRouteData.courier_id) {
      setCreateRouteError('Please select a courier')
      return
    }
    if (!newRouteData.start_address || !newRouteData.end_address) {
      setCreateRouteError('Please enter both start and end addresses')
      return
    }
    if (newRouteData.start_lat === 0 || newRouteData.end_lat === 0) {
      setCreateRouteError('Please select addresses from the autocomplete suggestions')
      return
    }

    setCreateRouteLoading(true)

    try {
      const submitData: AdminRouteCreate = {
        courier_id: newRouteData.courier_id,
        start_address: newRouteData.start_address,
        start_lat: newRouteData.start_lat,
        start_lng: newRouteData.start_lng,
        end_address: newRouteData.end_address,
        end_lat: newRouteData.end_lat,
        end_lng: newRouteData.end_lng,
        max_deviation_km: newRouteData.max_deviation_km,
        trip_date: newRouteData.trip_date || null,
        departure_time: newRouteData.departure_time || null
      }

      await adminAPI.createRoute(submitData)
      await loadData()
      setShowCreateRouteModal(false)
      setNewRouteData({
        courier_id: 0,
        start_address: '',
        start_lat: 0,
        start_lng: 0,
        end_address: '',
        end_lat: 0,
        end_lng: 0,
        max_deviation_km: 5,
        trip_date: '',
        departure_time: ''
      })
      alert('Route created successfully')
    } catch (err: any) {
      console.error('Error creating route:', err)
      setCreateRouteError(err.response?.data?.detail || 'Failed to create route')
    } finally {
      setCreateRouteLoading(false)
    }
  }

  const handleRunMatchingJob = async () => {
    if (matchingJobRunning) return

    setMatchingJobRunning(true)
    setMatchingJobResult(null)

    try {
      const response = await adminAPI.runMatchingJob(false, 24)
      setMatchingJobResult(response.data)
    } catch (err: any) {
      console.error('Error running matching job:', err)
      const errorMessage = err.response?.data?.detail || 'Failed to run matching job'
      alert(errorMessage)
    } finally {
      setMatchingJobRunning(false)
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

    // Filter by bid status
    if (bidStatusFilter === 'no_bids') {
      filtered = filtered.filter(pkg => pkg.bid_count === 0)
    } else if (bidStatusFilter === 'has_bids') {
      filtered = filtered.filter(pkg => pkg.bid_count > 0)
    } else if (bidStatusFilter === 'has_selected_bid') {
      filtered = filtered.filter(pkg => pkg.has_selected_bid)
    }

    return filtered
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
        return ['sender', 'both']
      case 'courier':
        return ['courier', 'both']
      case 'both':
        return ['both', 'admin']
      case 'admin':
        return ['admin', 'both']
      default:
        return [role]
    }
  }

  if (loading) {
    return <AdminDashboardSkeleton />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <FadeIn>
          <Alert variant="error" className="max-w-md">
            <div className="text-center">
              <p className="font-semibold mb-2">{error}</p>
              <p className="text-sm text-surface-600">Redirecting...</p>
            </div>
          </Alert>
        </FadeIn>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <FadeIn duration={300}>
        <div className="bg-primary-600 text-white shadow-md">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Chaski Admin Dashboard</h1>
              <div className="flex items-center gap-4">
                <span className="text-primary-100">
                  {user?.full_name} ({user?.email})
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await authAPI.logout()
                    } catch (err) {
                      console.error('Logout failed:', err)
                    }
                    router.push('/login')
                  }}
                  className="text-white hover:bg-primary-700"
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-surface-200">
        <div className="container mx-auto px-4">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-2 border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-primary-600 text-primary-600 font-semibold'
                  : 'border-transparent text-surface-600 hover:text-primary-600'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-2 border-b-2 transition ${
                activeTab === 'users'
                  ? 'border-primary-600 text-primary-600 font-semibold'
                  : 'border-transparent text-surface-600 hover:text-primary-600'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('packages')}
              className={`py-4 px-2 border-b-2 transition ${
                activeTab === 'packages'
                  ? 'border-primary-600 text-primary-600 font-semibold'
                  : 'border-transparent text-surface-600 hover:text-primary-600'
              }`}
            >
              Packages
            </button>
            <button
              onClick={() => setActiveTab('routes')}
              className={`py-4 px-2 border-b-2 transition ${
                activeTab === 'routes'
                  ? 'border-primary-600 text-primary-600 font-semibold'
                  : 'border-transparent text-surface-600 hover:text-primary-600'
              }`}
            >
              Routes ({routes.filter(r => r.is_active).length} active)
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <FadeIn duration={400}>
            <div>
              <h2 className="text-2xl font-bold text-surface-900 mb-6">Platform Overview</h2>

              {/* User Stats Cards */}
              <SlideIn direction="up" delay={100}>
                <h3 className="text-lg font-semibold text-surface-700 mb-4">User Statistics</h3>
                <StatsGrid columns={4} className="mb-8">
                  <StatsCard
                    label="Total Users"
                    value={stats.total_users}
                    variant="primary"
                    icon={
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    }
                  />
                  <StatsCard
                    label="Senders"
                    value={stats.total_senders}
                    variant="primary"
                    icon={
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    }
                  />
                  <StatsCard
                    label="Couriers"
                    value={stats.total_couriers}
                    variant="success"
                    icon={
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                  <StatsCard
                    label="Both Roles"
                    value={stats.total_both}
                    variant="default"
                    icon={
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    }
                  />
                </StatsGrid>
              </SlideIn>

              {/* Package Stats Cards */}
              <SlideIn direction="up" delay={200}>
                <h3 className="text-lg font-semibold text-surface-700 mb-4">Package Statistics</h3>
                <StatsGrid columns={4} className="mb-8">
                  <StatsCard
                    label="Total Packages"
                    value={stats.total_packages}
                    variant="warning"
                    icon={
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    }
                  />
                  <StatsCard
                    label="Active Packages"
                    value={stats.active_packages}
                    variant="primary"
                    icon={
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    }
                  />
                  <StatsCard
                    label="Completed"
                    value={stats.completed_packages}
                    variant="success"
                    icon={
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                  <StatsCard
                    label="Total Revenue"
                    value={`$${stats.total_revenue.toFixed(2)}`}
                    variant="success"
                    icon={
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                  />
                </StatsGrid>
              </SlideIn>

              {/* Charts Section */}
              <SlideIn direction="up" delay={300}>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {/* User Distribution Donut Chart */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-surface-900 mb-4">User Distribution</h3>
                    {stats.total_users > 0 ? (
                      <DonutChart
                        data={userRoleChartData}
                        height={250}
                        centerValue={stats.total_users}
                        centerLabel="Total Users"
                      />
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-surface-500">
                        No user data available
                      </div>
                    )}
                  </Card>

                  {/* Package Status Donut Chart */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-surface-900 mb-4">Package Status</h3>
                    {packageStatusChartData.length > 0 ? (
                      <DonutChart
                        data={packageStatusChartData}
                        height={250}
                        centerValue={packages.length}
                        centerLabel="Total"
                      />
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-surface-500">
                        No package data available
                      </div>
                    )}
                  </Card>

                  {/* Package Size Bar Chart */}
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-surface-900 mb-4">Package Sizes</h3>
                    {packageSizeChartData.length > 0 ? (
                      <BarChart
                        data={packageSizeChartData}
                        height={250}
                        color="#3B82F6"
                        showGrid={true}
                      />
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-surface-500">
                        No package data available
                      </div>
                    )}
                  </Card>
                </div>
              </SlideIn>

              {/* Quick Actions */}
              <SlideIn direction="up" delay={400}>
                <Card className="p-6">
                  <h3 className="text-xl font-bold text-surface-900 mb-4">Quick Actions</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Button
                      variant="primary"
                      onClick={() => setActiveTab('users')}
                      className="w-full justify-center"
                    >
                      Manage Users
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => setActiveTab('packages')}
                      className="w-full justify-center"
                    >
                      View Packages
                    </Button>
                    <Button
                      variant="success"
                      onClick={handleRunMatchingJob}
                      disabled={matchingJobRunning}
                      loading={matchingJobRunning}
                      className="w-full justify-center"
                      leftIcon={!matchingJobRunning ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      ) : undefined}
                    >
                      {matchingJobRunning ? 'Running...' : 'Run Matching Job'}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled
                      className="w-full justify-center"
                    >
                      Generate Reports (Soon)
                    </Button>
                  </div>

                  {/* Matching Job Results */}
                  {matchingJobResult && (
                    <div className="mt-6 p-4 bg-success-50 border border-success-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-lg font-semibold text-success-800 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Matching Job Completed
                        </h4>
                        <button
                          onClick={() => setMatchingJobResult(null)}
                          className="text-surface-500 hover:text-surface-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div className="bg-white p-3 rounded shadow-sm">
                          <div className="text-surface-500">Routes Processed</div>
                          <div className="text-2xl font-bold text-primary-600">{matchingJobResult.routes_processed}</div>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm">
                          <div className="text-surface-500">Matches Found</div>
                          <div className="text-2xl font-bold text-info-600">{matchingJobResult.total_matches_found}</div>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm">
                          <div className="text-surface-500">Notifications Sent</div>
                          <div className="text-2xl font-bold text-success-600">{matchingJobResult.notifications_created}</div>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm">
                          <div className="text-surface-500">Skipped (Recent)</div>
                          <div className="text-2xl font-bold text-surface-600">{matchingJobResult.notifications_skipped}</div>
                        </div>
                      </div>

                      {/* Detailed Route/Package Breakdown */}
                      {matchingJobResult.route_details && matchingJobResult.route_details.length > 0 && (
                        <div className="mt-4 border-t border-success-200 pt-4">
                          <h5 className="text-sm font-semibold text-success-800 mb-3">Match Details by Courier</h5>
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {matchingJobResult.route_details.map((rd) => (
                              <div key={rd.route_id} className="bg-white p-3 rounded shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <span className="font-medium text-surface-900">{rd.courier_name}</span>
                                    <span className="text-surface-400 text-xs ml-2">(Route #{rd.route_id})</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="info" size="sm">
                                      {rd.matches_found} match{rd.matches_found !== 1 ? 'es' : ''}
                                    </Badge>
                                    <Badge variant={rd.notifications_sent > 0 ? 'success' : 'secondary'} size="sm">
                                      {rd.notifications_sent} notified
                                    </Badge>
                                  </div>
                                </div>
                                <div className="text-xs text-surface-500 mb-2">
                                  {rd.route}
                                </div>
                                {rd.matched_packages && rd.matched_packages.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {rd.matched_packages.map((pkg) => (
                                      <div key={pkg.tracking_id || pkg.package_id} className="flex items-center justify-between text-xs bg-surface-50 p-2 rounded">
                                        <div className="flex items-center gap-2">
                                          <Link href={`/packages/${pkg.tracking_id || pkg.package_id}`} className="text-primary-600 hover:underline font-medium">
                                            {pkg.tracking_id || `#${pkg.package_id}`}
                                          </Link>
                                          <span className="text-surface-500 truncate max-w-[150px]">{pkg.description}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-surface-400">{pkg.distance_km}km from route</span>
                                          {pkg.notified ? (
                                            <span className="text-success-600">Notified</span>
                                          ) : (
                                            <span className="text-surface-400">Skipped</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </SlideIn>
            </div>
          </FadeIn>
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
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        ID
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
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="text-sm font-medium text-purple-600 hover:text-purple-700 hover:underline"
                          >
                            {u.full_name}
                          </Link>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className={`text-sm border rounded px-2 py-1 ${
                              u.id === user?.id ? 'bg-gray-100 cursor-not-allowed' : ''
                            }`}
                            disabled={!u.is_active || u.id === user?.id}
                            title={u.id === user?.id ? 'You cannot change your own role' : ''}
                          >
                            {getAllowedRoles(u.role).map((role) => (
                              <option key={role} value={role}>
                                {role.charAt(0).toUpperCase() + role.slice(1)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleUserVerified(u.id, u.is_verified)}
                            disabled={!u.is_active}
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer transition-colors ${
                              u.is_verified
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            } ${!u.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={u.is_active ? `Click to ${u.is_verified ? 'unverify' : 'verify'} email` : 'Cannot modify inactive user'}
                          >
                            {u.is_verified ? 'Verified' : 'Unverified'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {u.phone_number ? (
                            <button
                              onClick={() => handleTogglePhoneVerified(u.id, u.phone_verified)}
                              disabled={!u.is_active}
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer transition-colors ${
                                u.phone_verified
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              } ${!u.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={u.is_active ? `Click to ${u.phone_verified ? 'unverify' : 'verify'} phone` : 'Cannot modify inactive user'}
                            >
                              {u.phone_verified ? 'Verified' : 'Unverified'}
                            </button>
                          ) : (
                            <span className="px-2 py-1 text-xs text-gray-400">No phone</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleIdVerified(u.id, u.id_verified)}
                            disabled={!u.is_active}
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer transition-colors ${
                              u.id_verified
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            } ${!u.is_active ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={u.is_active ? `Click to ${u.id_verified ? 'unverify' : 'verify'} ID` : 'Cannot modify inactive user'}
                          >
                            {u.id_verified ? 'Verified' : 'Unverified'}
                          </button>
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
                            u.id === user?.id ? (
                              <span
                                className="text-gray-400 cursor-not-allowed"
                                title="You cannot deactivate your own account"
                              >
                                Deactivate
                              </span>
                            ) : (
                              <button
                                onClick={() => handleToggleUserActive(u.id, u.is_active)}
                                className="text-red-600 hover:text-red-900 font-medium"
                              >
                                Deactivate
                              </button>
                            )
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
                    <option value="new">New</option>
                    <option value="open_for_bids">Open for Bids</option>
                    <option value="bid_selected">Bid Selected</option>
                    <option value="pending_pickup">Pending Pickup</option>
                    <option value="in_transit">In Transit</option>
                    <option value="delivered">Delivered</option>
                    <option value="canceled">Canceled</option>
                    <option value="failed">Failed</option>
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

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Bid Status:</label>
                  <select
                    value={bidStatusFilter}
                    onChange={(e) => setBidStatusFilter(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Bids</option>
                    <option value="no_bids">No Bids</option>
                    <option value="has_bids">Has Bids</option>
                    <option value="has_selected_bid">Has Selected Bid</option>
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
                      setBidStatusFilter('all')
                    }}
                    className="text-purple-600 hover:text-purple-700 text-sm underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Package ID
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Sender
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Description
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Bids
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Routes
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Active
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Price
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Created
                      </th>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredPackages().map((pkg) => {
                      const sender = users.find(u => u.id === pkg.sender_id)
                      return (
                        <tr key={pkg.id} className={!pkg.is_active ? 'bg-gray-50 opacity-60' : ''}>
                          <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
                            <a
                              href={`/packages/${pkg.tracking_id}`}
                              className="text-purple-600 hover:text-purple-700 font-semibold"
                            >
                              {pkg.tracking_id}
                            </a>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                            <div className="font-medium text-xs">{sender?.full_name || 'Unknown'}</div>
                            <div className="text-gray-500 text-xs truncate max-w-[120px]">{sender?.email}</div>
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-500">
                            <div className="max-w-[150px] truncate text-xs">{pkg.description}</div>
                            <div className="text-xs text-gray-400">
                              {pkg.size} · {pkg.weight_kg}kg
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {pkg.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-center">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              pkg.has_selected_bid
                                ? 'bg-green-100 text-green-800'
                                : pkg.bid_count > 0
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {pkg.bid_count}{pkg.has_selected_bid && ' ✓'}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-center">
                            {pkg.status.toLowerCase() === 'open_for_bids' ? (
                              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                pkg.matched_routes_count > 0
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {pkg.matched_routes_count}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-center">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              pkg.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {pkg.is_active ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                            ${pkg.price?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                            {new Date(pkg.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-sm">
                            {pkg.is_active ? (
                              ['new', 'open_for_bids'].includes(pkg.status.toLowerCase()) ? (
                                <button
                                  onClick={() => handleTogglePackageActive(pkg.id, pkg.is_active)}
                                  className="text-red-600 hover:text-red-900 font-medium"
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs" title="Only new or open for bids packages can be deactivated">
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

        {activeTab === 'routes' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Courier Routes</h2>
                <div className="text-gray-600 text-sm mt-1">
                  Total Routes: {routes.length} ({routes.filter(r => r.is_active).length} active)
                </div>
              </div>
              <button
                onClick={() => setShowCreateRouteModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Route
              </button>
            </div>

            {routes.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-600">No courier routes found</div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Courier
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        From
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        To
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Trip Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Deviation
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {routes.map((route) => (
                      <tr key={route.id} className={!route.is_active ? 'bg-gray-50' : ''}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">#{route.id}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            <Link href={`/admin/users/${route.courier_id}`} className="text-purple-600 hover:text-purple-900">
                              {route.courier_name}
                            </Link>
                          </div>
                          <div className="text-xs text-gray-500">{route.courier_email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 max-w-[200px] truncate" title={route.start_address}>
                            {route.start_address}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 max-w-[200px] truncate" title={route.end_address}>
                            {route.end_address}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {route.trip_date
                            ? new Date(route.trip_date).toLocaleDateString()
                            : route.departure_time
                              ? new Date(route.departure_time).toLocaleDateString()
                              : 'Not set'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {route.max_deviation_km} km
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            route.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {route.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(route.created_at).toLocaleDateString()}
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

      {/* Create Route Modal */}
      {showCreateRouteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Create Route for Courier</h3>
              <button
                onClick={() => {
                  setShowCreateRouteModal(false)
                  setCreateRouteError('')
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {createRouteError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {createRouteError}
              </div>
            )}

            <form onSubmit={handleCreateRoute} className="space-y-4">
              {/* Courier Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Courier *
                </label>
                <select
                  required
                  value={newRouteData.courier_id}
                  onChange={(e) => setNewRouteData({ ...newRouteData, courier_id: parseInt(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={0}>-- Select a courier --</option>
                  {courierUsers.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.full_name} ({courier.email}) - {courier.role}
                    </option>
                  ))}
                </select>
                {courierUsers.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    No active users with courier or both role found.
                  </p>
                )}
              </div>

              {/* Start Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Address *
                </label>
                <AddressAutocomplete
                  id="admin_route_start_address"
                  name="start_address"
                  value={newRouteData.start_address}
                  onChange={(address: string, lat: number, lng: number) => {
                    setNewRouteData({
                      ...newRouteData,
                      start_address: address,
                      start_lat: lat,
                      start_lng: lng
                    })
                  }}
                  placeholder="Where is the courier leaving from?"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* End Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Address *
                </label>
                <AddressAutocomplete
                  id="admin_route_end_address"
                  name="end_address"
                  value={newRouteData.end_address}
                  onChange={(address: string, lat: number, lng: number) => {
                    setNewRouteData({
                      ...newRouteData,
                      end_address: address,
                      end_lat: lat,
                      end_lng: lng
                    })
                  }}
                  placeholder="Where is the courier going?"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Max Deviation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Deviation (km)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={newRouteData.max_deviation_km}
                    onChange={(e) => setNewRouteData({ ...newRouteData, max_deviation_km: parseInt(e.target.value) || 5 })}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <span className="w-16 text-center text-sm font-medium text-gray-700">
                    {newRouteData.max_deviation_km} km
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  How far from the route the courier is willing to deviate for pickups.
                </p>
              </div>

              {/* Trip Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trip Date
                </label>
                <input
                  type="date"
                  value={newRouteData.trip_date}
                  onChange={(e) => setNewRouteData({ ...newRouteData, trip_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Departure Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Departure Time (optional)
                </label>
                <input
                  type="time"
                  value={newRouteData.departure_time}
                  onChange={(e) => setNewRouteData({ ...newRouteData, departure_time: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={createRouteLoading}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {createRouteLoading ? 'Creating...' : 'Create Route'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateRouteModal(false)
                    setCreateRouteError('')
                  }}
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
