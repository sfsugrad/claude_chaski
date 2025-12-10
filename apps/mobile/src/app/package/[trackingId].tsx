import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useLocalSearchParams, router } from 'expo-router'
import { api } from '@/services/api'
import { getStatusLabel, getStatusColor } from '@chaski/shared-utils'
import type { PackageResponse } from '@chaski/shared-types'

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

export default function PackageDetailScreen() {
  const { t } = useTranslation()
  const { trackingId } = useLocalSearchParams<{ trackingId: string }>()
  const [refreshing, setRefreshing] = useState(false)

  const { data: packageData, refetch, isLoading, error } = useQuery({
    queryKey: ['package', trackingId],
    queryFn: () => api.packagesAPI.getByTrackingId(trackingId!),
    enabled: !!trackingId,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    )
  }

  if (error || !packageData?.data) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('common.error')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const pkg: PackageResponse = packageData.data

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.trackingId}>{pkg.tracking_id}</Text>
            <Text style={styles.createdAt}>
              {t('packages.created')}: {new Date(pkg.created_at).toLocaleDateString()}
            </Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: getStatusColorHex(pkg.status) }]}
          >
            <Text style={styles.statusText}>{getStatusLabel(pkg.status)}</Text>
          </View>
        </View>
        <Text style={styles.description}>{pkg.description}</Text>
      </View>

      {/* Package Details */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('packages.packageDetails')}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('packages.size')}</Text>
          <Text style={styles.detailValue}>{pkg.size.replace('_', ' ')}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('packages.weight')}</Text>
          <Text style={styles.detailValue}>{pkg.weight_kg} kg</Text>
        </View>

        {pkg.price !== null && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('packages.price')}</Text>
            <Text style={[styles.detailValue, styles.priceValue]}>${pkg.price.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Route Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('packages.route')}</Text>

        <View style={styles.addressSection}>
          <View style={styles.addressIcon}>
            <View style={styles.pickupDot} />
            <View style={styles.routeLine} />
            <View style={styles.dropoffDot} />
          </View>

          <View style={styles.addressContent}>
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>{t('packages.pickupAddress')}</Text>
              <Text style={styles.addressValue}>{pkg.pickup_address}</Text>
              {pkg.pickup_contact_name && (
                <Text style={styles.contactText}>
                  {pkg.pickup_contact_name}
                  {pkg.pickup_contact_phone && ` - ${pkg.pickup_contact_phone}`}
                </Text>
              )}
            </View>

            <View style={[styles.addressBlock, styles.addressBlockEnd]}>
              <Text style={styles.addressLabel}>{t('packages.deliveryAddress')}</Text>
              <Text style={styles.addressValue}>{pkg.dropoff_address}</Text>
              {pkg.dropoff_contact_name && (
                <Text style={styles.contactText}>
                  {pkg.dropoff_contact_name}
                  {pkg.dropoff_contact_phone && ` - ${pkg.dropoff_contact_phone}`}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Participants Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('packages.participants')}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('packages.sender')}</Text>
          <Text style={styles.detailValue}>{pkg.sender_name || '-'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('packages.courier')}</Text>
          <Text style={styles.detailValue}>{pkg.courier_name || t('packages.notAssigned')}</Text>
        </View>
      </View>

      {/* Timeline Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('packages.timeline')}</Text>

        <View style={styles.timelineItem}>
          <View style={[styles.timelineDot, styles.timelineDotActive]} />
          <View style={styles.timelineContent}>
            <Text style={styles.timelineLabel}>{t('packages.created')}</Text>
            <Text style={styles.timelineDate}>
              {new Date(pkg.created_at).toLocaleString()}
            </Text>
          </View>
        </View>

        {pkg.matched_at && (
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, styles.timelineDotActive]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>{t('packages.matched')}</Text>
              <Text style={styles.timelineDate}>
                {new Date(pkg.matched_at).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {pkg.accepted_at && (
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, styles.timelineDotActive]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>{t('packages.accepted')}</Text>
              <Text style={styles.timelineDate}>
                {new Date(pkg.accepted_at).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {pkg.picked_up_at && (
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, styles.timelineDotActive]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>{t('packages.pickedUp')}</Text>
              <Text style={styles.timelineDate}>
                {new Date(pkg.picked_up_at).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {pkg.in_transit_at && (
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, styles.timelineDotActive]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>{t('packages.inTransit')}</Text>
              <Text style={styles.timelineDate}>
                {new Date(pkg.in_transit_at).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {pkg.status === 'DELIVERED' && pkg.status_changed_at && (
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, styles.timelineDotDelivered]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>{t('packages.delivered')}</Text>
              <Text style={styles.timelineDate}>
                {new Date(pkg.status_changed_at).toLocaleString()}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Bidding Info */}
      {pkg.bid_count > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t('packages.bidding')}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('packages.totalBids')}</Text>
            <Text style={styles.detailValue}>{pkg.bid_count}</Text>
          </View>

          {pkg.bid_deadline && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('packages.bidDeadline')}</Text>
              <Text style={styles.detailValue}>
                {new Date(pkg.bid_deadline).toLocaleString()}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Spacer at bottom */}
      <View style={{ height: 32 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  trackingId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  createdAt: {
    fontSize: 12,
    color: '#9ca3af',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
  },
  priceValue: {
    color: '#22c55e',
  },
  addressSection: {
    flexDirection: 'row',
  },
  addressIcon: {
    width: 24,
    alignItems: 'center',
    paddingTop: 4,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#d1d5db',
    marginVertical: 4,
  },
  dropoffDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  addressContent: {
    flex: 1,
    marginLeft: 12,
  },
  addressBlock: {
    paddingBottom: 16,
  },
  addressBlockEnd: {
    paddingBottom: 0,
    paddingTop: 16,
  },
  addressLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  addressValue: {
    fontSize: 14,
    color: '#111',
    fontWeight: '500',
  },
  contactText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#d1d5db',
    marginTop: 4,
    marginRight: 12,
  },
  timelineDotActive: {
    backgroundColor: '#3b82f6',
  },
  timelineDotDelivered: {
    backgroundColor: '#22c55e',
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
  },
  timelineDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
})
