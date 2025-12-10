import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/services/api'

type ViewMode = 'sender' | 'courier'

export default function DashboardScreen() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [refreshing, setRefreshing] = useState(false)

  const isBothRole = user?.role === 'both'
  const isCourier = user?.role === 'courier' || user?.role === 'both'
  const isSender = user?.role === 'sender' || user?.role === 'both'

  // For "both" role users, allow switching between views
  // Default to sender view for "both" role users
  const [viewMode, setViewMode] = useState<ViewMode>(isBothRole ? 'sender' : (isCourier ? 'courier' : 'sender'))

  const { data: senderStats, refetch: refetchSender } = useQuery({
    queryKey: ['senderStats'],
    queryFn: () => api.analyticsAPI.getSenderStats(),
    enabled: isSender,
  })

  const { data: courierStats, refetch: refetchCourier } = useQuery({
    queryKey: ['courierStats'],
    queryFn: () => api.analyticsAPI.getCourierStats(),
    enabled: isCourier,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      isSender && refetchSender(),
      isCourier && refetchCourier(),
    ])
    setRefreshing(false)
  }, [isSender, isCourier, refetchSender, refetchCourier])

  // Determine what to show based on role and view mode
  const showSenderStats = isBothRole ? viewMode === 'sender' : isSender
  const showCourierStats = isBothRole ? viewMode === 'courier' : isCourier

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.welcome}>
        {t('dashboard.welcome', { name: user?.full_name || 'User' })}
      </Text>

      {/* Role Switcher for "both" role users */}
      {isBothRole && (
        <View style={styles.roleSwitcherContainer}>
          <Text style={styles.viewAsLabel}>{t('dashboard.viewAs')}</Text>
          <View style={styles.roleSwitcher}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                viewMode === 'sender' && styles.roleButtonActive,
              ]}
              onPress={() => setViewMode('sender')}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  viewMode === 'sender' && styles.roleButtonTextActive,
                ]}
              >
                {t('dashboard.sender')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleButton,
                viewMode === 'courier' && styles.roleButtonActive,
              ]}
              onPress={() => setViewMode('courier')}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  viewMode === 'courier' && styles.roleButtonTextActive,
                ]}
              >
                {t('dashboard.courier')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>{t('dashboard.stats')}</Text>

        {showSenderStats && senderStats && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{senderStats.data.total_packages}</Text>
              <Text style={styles.statLabel}>{t('dashboard.totalPackages')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{senderStats.data.packages_this_month}</Text>
              <Text style={styles.statLabel}>{t('dashboard.activeDeliveries')}</Text>
            </View>
          </View>
        )}

        {showCourierStats && courierStats && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{courierStats.data.total_deliveries}</Text>
              <Text style={styles.statLabel}>{t('dashboard.completedDeliveries')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ${(courierStats.data.total_earnings || 0).toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>{t('dashboard.totalEarnings')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {courierStats.data.average_rating?.toFixed(1) || '-'}
              </Text>
              <Text style={styles.statLabel}>{t('dashboard.averageRating')}</Text>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16,
  },
  roleSwitcherContainer: {
    marginBottom: 20,
  },
  viewAsLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  roleSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleButtonTextActive: {
    color: '#3b82f6',
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minWidth: '45%',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
})
