import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'

type TabType = 'received' | 'given'

export default function ReviewsScreen() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('received')

  const { data: receivedRatings, isLoading: receivedLoading } = useQuery({
    queryKey: ['ratings', 'received', user?.id],
    queryFn: async () => {
      if (!user?.id) return { ratings: [] }
      const response = await api.ratingsAPI.getUserRatings(user.id)
      return response.data
    },
    enabled: !!user?.id,
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['ratings', 'summary', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const response = await api.ratingsAPI.getUserRatingSummary(user.id)
      return response.data
    },
    enabled: !!user?.id,
  })

  const isLoading = receivedLoading || summaryLoading
  const ratings = receivedRatings?.ratings || []

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const StarDisplay = ({ rating, size = 16 }: { rating: number; size?: number }) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color="#fbbf24"
          />
        ))}
      </View>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('nav.reviews'),
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : (
          <>
            {/* Rating Summary */}
            {summary && activeTab === 'received' && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryScore}>
                    <Text style={styles.averageRating}>
                      {summary.average_rating?.toFixed(1) || '-'}
                    </Text>
                    <StarDisplay rating={summary.average_rating || 0} size={20} />
                    <Text style={styles.totalRatings}>
                      {summary.total_ratings} {summary.total_ratings === 1 ? 'review' : 'reviews'}
                    </Text>
                  </View>

                  {/* Rating Breakdown */}
                  <View style={styles.breakdown}>
                    {[5, 4, 3, 2, 1].map((score) => {
                      const count = summary.rating_breakdown?.[score] || 0
                      const percentage = summary.total_ratings > 0
                        ? (count / summary.total_ratings) * 100
                        : 0

                      return (
                        <View key={score} style={styles.breakdownRow}>
                          <Text style={styles.breakdownScore}>{score}</Text>
                          <Ionicons name="star" size={12} color="#fbbf24" />
                          <View style={styles.breakdownBarContainer}>
                            <View
                              style={[styles.breakdownBar, { width: `${percentage}%` }]}
                            />
                          </View>
                          <Text style={styles.breakdownCount}>{count}</Text>
                        </View>
                      )
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'received' && styles.activeTab]}
                onPress={() => setActiveTab('received')}
              >
                <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>
                  {t('bids.reviews')} ({ratings.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Reviews List */}
            <View style={styles.reviewsList}>
              {ratings.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📝</Text>
                  <Text style={styles.emptyText}>
                    {t('common.emptyState')}
                  </Text>
                  <Text style={styles.emptySubtext}>
                    Complete deliveries to start receiving reviews
                  </Text>
                </View>
              ) : (
                ratings.map((rating: { id: number; rater_name?: string; score: number; comment?: string; created_at: string }) => (
                  <View key={rating.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View>
                        <Text style={styles.reviewerName}>
                          {rating.rater_name || 'Anonymous User'}
                        </Text>
                        <StarDisplay rating={rating.score} size={14} />
                      </View>
                      <Text style={styles.reviewDate}>{formatDate(rating.created_at)}</Text>
                    </View>
                    {rating.comment ? (
                      <Text style={styles.reviewComment}>{rating.comment}</Text>
                    ) : (
                      <Text style={styles.noComment}>No comment provided</Text>
                    )}
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </>
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
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: '#6b7280',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    gap: 24,
  },
  summaryScore: {
    alignItems: 'center',
  },
  averageRating: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#111',
  },
  totalRatings: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  breakdown: {
    flex: 1,
    justifyContent: 'center',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  breakdownScore: {
    fontSize: 12,
    color: '#6b7280',
    width: 12,
  },
  breakdownBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
  breakdownBar: {
    height: 8,
    backgroundColor: '#fbbf24',
    borderRadius: 4,
  },
  breakdownCount: {
    fontSize: 12,
    color: '#6b7280',
    width: 24,
    textAlign: 'right',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
  },
  reviewsList: {
    backgroundColor: '#fff',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  reviewCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111',
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  noComment: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
})
