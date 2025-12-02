import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { api } from '@/services/api'
import { getStatusLabel, getStatusColor } from '@chaski/shared-utils'
import type { PackageResponse } from '@chaski/shared-types'

export default function PackagesScreen() {
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)

  const { data: packages, refetch } = useQuery({
    queryKey: ['packages'],
    queryFn: () => api.packagesAPI.getAll(),
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const renderPackage = ({ item }: { item: PackageResponse }) => (
    <TouchableOpacity
      style={styles.packageCard}
      onPress={() => router.push(`/package/${item.tracking_id}`)}
    >
      <View style={styles.packageHeader}>
        <Text style={styles.trackingId}>{item.tracking_id}</Text>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColorHex(item.status) },
          ]}
        >
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.addresses}>
        <Text style={styles.addressLabel}>{t('packages.pickupAddress')}</Text>
        <Text style={styles.address} numberOfLines={1}>
          {item.pickup_address}
        </Text>
        <Text style={styles.addressLabel}>{t('packages.deliveryAddress')}</Text>
        <Text style={styles.address} numberOfLines={1}>
          {item.dropoff_address}
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/package/create')}
      >
        <Text style={styles.createButtonText}>{t('packages.createNew')}</Text>
      </TouchableOpacity>

      <FlatList
        data={packages?.data || []}
        renderItem={renderPackage}
        keyExtractor={(item) => item.tracking_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('common.emptyState')}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  )
}

function getStatusColorHex(status: string): string {
  const colorMap: Record<string, string> = {
    gray: '#9ca3af',
    blue: '#3b82f6',
    purple: '#8b5cf6',
    yellow: '#eab308',
    orange: '#f97316',
    green: '#22c55e',
    red: '#ef4444',
  }
  const color = getStatusColor(status)
  return colorMap[color] || colorMap.gray
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  packageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trackingId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
    marginBottom: 12,
  },
  addresses: {
    gap: 4,
  },
  addressLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  address: {
    fontSize: 14,
    color: '#374151',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
})
