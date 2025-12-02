import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { api } from '@/services/api'
import { formatMiles } from '@chaski/shared-utils'
import type { RouteResponse } from '@chaski/shared-types'

export default function RoutesScreen() {
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)

  const { data: routes, refetch } = useQuery({
    queryKey: ['routes'],
    queryFn: () => api.couriersAPI.getRoutes(),
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const renderRoute = ({ item }: { item: RouteResponse }) => (
    <TouchableOpacity
      style={[styles.routeCard, item.is_active && styles.activeRoute]}
      onPress={() => router.push(`/route/${item.id}`)}
    >
      <View style={styles.routeHeader}>
        <Text style={styles.routeId}>Route #{item.id}</Text>
        {item.is_active && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{t('courier.activeRoute')}</Text>
          </View>
        )}
      </View>

      <View style={styles.routeAddresses}>
        <View style={styles.addressRow}>
          <Text style={styles.addressLabel}>{t('courier.from')}</Text>
          <Text style={styles.address} numberOfLines={1}>
            {item.start_address}
          </Text>
        </View>
        <View style={styles.addressRow}>
          <Text style={styles.addressLabel}>{t('courier.to')}</Text>
          <Text style={styles.address} numberOfLines={1}>
            {item.end_address}
          </Text>
        </View>
      </View>

      <View style={styles.routeFooter}>
        <Text style={styles.deviation}>
          Max deviation: {formatMiles(item.max_deviation_km)}
        </Text>
        {item.trip_date && (
          <Text style={styles.date}>
            {new Date(item.trip_date).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/route/create')}
      >
        <Text style={styles.createButtonText}>{t('courier.createRoute')}</Text>
      </TouchableOpacity>

      <FlatList
        data={routes?.data || []}
        renderItem={renderRoute}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('courier.noActiveRoute')}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  )
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
  routeCard: {
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
  activeRoute: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  routeAddresses: {
    gap: 8,
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressLabel: {
    fontSize: 12,
    color: '#9ca3af',
    width: 40,
  },
  address: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  routeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  deviation: {
    fontSize: 12,
    color: '#6b7280',
  },
  date: {
    fontSize: 12,
    color: '#6b7280',
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
