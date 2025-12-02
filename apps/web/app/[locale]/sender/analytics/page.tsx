'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authAPI, analyticsAPI, SenderStatsResponse, UserResponse } from '@/lib/api'
import {
  StatsCard,
  StatsGrid,
  Card,
  Button,
  FadeIn,
  SlideIn
} from '@/components/ui'
import { BarChart, DonutChart } from '@/components/charts'

// Status colors matching the design system
const STATUS_COLORS: Record<string, string> = {
  open_for_bids: '#F59E0B',
  bid_selected: '#3B82F6',
  pending_pickup: '#8B5CF6',
  in_transit: '#06B6D4',
  delivered: '#10B981',
  canceled: '#EF4444',
  failed: '#F97316',
}

const STATUS_LABELS: Record<string, string> = {
  open_for_bids: 'Open for Bids',
  bid_selected: 'Bid Selected',
  pending_pickup: 'Pending Pickup',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  canceled: 'Canceled',
  failed: 'Failed',
}

export default function SenderAnalyticsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [stats, setStats] = useState<SenderStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    checkAuthAndLoadData()
  }, [])

  const checkAuthAndLoadData = async () => {
    try {
      const response = await authAPI.getCurrentUser()
      const currentUser = response.data

      if (!['sender', 'both', 'SENDER', 'BOTH', 'admin', 'ADMIN'].includes(currentUser.role)) {
        setError('Access denied. Sender privileges required.')
        setTimeout(() => router.push('/'), 3000)
        return
      }

      setUser(currentUser)

      // Load sender stats
      const statsResponse = await analyticsAPI.getSenderStats()
      setStats(statsResponse.data)
    } catch (err) {
      console.error('Error loading analytics:', err)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  // Prepare donut chart data for status breakdown
  const statusChartData = useMemo(() => {
    if (!stats?.status_breakdown) return []

    return Object.entries(stats.status_breakdown)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => {
        // Normalize status to lowercase (backend returns uppercase)
        const normalizedStatus = status.toLowerCase()
        return {
          name: STATUS_LABELS[normalizedStatus] || status.replace(/_/g, ' '),
          value: count,
          color: STATUS_COLORS[normalizedStatus] || '#6B7280',
        }
      })
  }, [stats])

  // Prepare bar chart data for monthly packages
  const monthlyChartData = useMemo(() => {
    if (!stats?.packages_by_month) return []

    return stats.packages_by_month.map(item => ({
      name: item.month,
      value: item.count,
    }))
  }, [stats])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 p-8">
        <div className="container mx-auto max-w-6xl">
          <div className="animate-pulse">
            <div className="h-8 bg-surface-200 rounded w-48 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 bg-surface-200 rounded-lg"></div>
              ))}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-80 bg-surface-200 rounded-lg"></div>
              <div className="h-80 bg-surface-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <FadeIn>
          <div className="bg-error-50 border border-error-200 rounded-lg p-6 max-w-md text-center">
            <p className="font-semibold text-error-800 mb-2">{error}</p>
            <p className="text-sm text-surface-600">Redirecting...</p>
          </div>
        </FadeIn>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <FadeIn duration={300}>
        <div className="bg-white border-b border-surface-200 shadow-sm">
          <div className="container mx-auto max-w-6xl px-4 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-surface-900">My Analytics</h1>
                <p className="text-surface-600 text-sm mt-1">
                  Track your package delivery statistics
                </p>
              </div>
              <Link href="/sender">
                <Button variant="ghost" size="sm">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Packages
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Main Content */}
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Summary Cards */}
        <SlideIn direction="up" delay={100}>
          <StatsGrid columns={4} className="mb-8">
            <StatsCard
              label="Total Packages"
              value={stats?.total_packages || 0}
              variant="primary"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
            />
            <StatsCard
              label="This Month"
              value={stats?.packages_this_month || 0}
              variant="default"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            <StatsCard
              label="Delivery Rate"
              value={`${(stats?.delivery_rate || 0).toFixed(0)}%`}
              variant="success"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatsCard
              label="Total Spent"
              value={`$${(stats?.total_spent || 0).toFixed(2)}`}
              variant="warning"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </StatsGrid>
        </SlideIn>

        {/* Charts Row */}
        <SlideIn direction="up" delay={200}>
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Status Breakdown Donut Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-surface-900 mb-4">Package Status Breakdown</h3>
              {statusChartData.length > 0 ? (
                <DonutChart
                  data={statusChartData}
                  height={280}
                  centerValue={stats?.total_packages || 0}
                  centerLabel="Total"
                />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-surface-500">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto text-surface-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p>No packages yet</p>
                    <Link href="/sender" className="text-primary-600 hover:text-primary-700 text-sm mt-2 inline-block">
                      Create your first package
                    </Link>
                  </div>
                </div>
              )}
            </Card>

            {/* Packages Over Time Bar Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-surface-900 mb-4">Packages Over Time</h3>
              {monthlyChartData.length > 0 ? (
                <BarChart
                  data={monthlyChartData}
                  height={280}
                  color="#3B82F6"
                  showGrid={true}
                />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-surface-500">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto text-surface-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p>No data available yet</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </SlideIn>

        {/* Additional Stats */}
        {stats?.average_delivery_time_hours !== null && stats?.average_delivery_time_hours !== undefined && (
          <SlideIn direction="up" delay={300}>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-surface-900 mb-4">Delivery Performance</h3>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-success-100 rounded-lg">
                  <svg className="w-8 h-8 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-surface-900">
                    {stats.average_delivery_time_hours < 24
                      ? `${stats.average_delivery_time_hours.toFixed(1)} hours`
                      : `${(stats.average_delivery_time_hours / 24).toFixed(1)} days`}
                  </div>
                  <div className="text-surface-600 text-sm">Average Delivery Time</div>
                </div>
              </div>
            </Card>
          </SlideIn>
        )}
      </div>
    </div>
  )
}
