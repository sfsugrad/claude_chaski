import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native'
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { api } from '@/services/api'
import type { ConversationSummary } from '@chaski/shared-types'

export default function MessagesScreen() {
  const { t } = useTranslation()
  const [refreshing, setRefreshing] = useState(false)

  const { data: conversations, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.messagesAPI.getConversations(),
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return t('time.justNow')
    if (diffMins < 60) return t('time.minutesAgo', { count: diffMins })
    if (diffHours < 24) return t('time.hoursAgo', { count: diffHours })
    if (diffDays < 7) return t('time.daysAgo', { count: diffDays })
    return date.toLocaleDateString()
  }

  const renderConversation = ({ item }: { item: ConversationSummary }) => (
    <TouchableOpacity
      style={[styles.conversationCard, item.unread_count > 0 && styles.unread]}
      onPress={() => router.push(`/messages/${item.tracking_id}`)}
    >
      <View style={styles.conversationHeader}>
        <Text style={styles.userName}>{item.other_user_name}</Text>
        <Text style={styles.time}>{formatTime(item.last_message_at)}</Text>
      </View>
      <Text style={styles.packageDescription} numberOfLines={1}>
        {t('messages.regarding')}: {item.package_description}
      </Text>
      <View style={styles.messageRow}>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message}
        </Text>
        {item.unread_count > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>{item.unread_count}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations?.data.conversations || []}
        renderItem={renderConversation}
        keyExtractor={(item) => item.tracking_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('messages.noConversations')}</Text>
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
  listContent: {
    padding: 16,
  },
  conversationCard: {
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
  unread: {
    backgroundColor: '#eff6ff',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  time: {
    fontSize: 12,
    color: '#9ca3af',
  },
  packageDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
