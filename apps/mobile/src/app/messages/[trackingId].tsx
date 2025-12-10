import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, Stack } from 'expo-router'
import { api } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import type { MessageResponse } from '@chaski/shared-types'

export default function ConversationScreen() {
  const { t } = useTranslation()
  const { trackingId } = useLocalSearchParams<{ trackingId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const flatListRef = useRef<FlatList>(null)

  const [newMessage, setNewMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const { data: messagesData, refetch, isLoading, error } = useQuery({
    queryKey: ['messages', trackingId],
    queryFn: () => api.messagesAPI.getPackageMessages(trackingId!),
    enabled: !!trackingId,
    refetchInterval: 10000, // Refresh every 10 seconds
  })

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      console.log('Sending message to trackingId:', trackingId)
      console.log('Message content:', content)
      try {
        const result = await api.messagesAPI.sendMessage(trackingId!, content)
        console.log('Send message result:', result)
        return result
      } catch (err: any) {
        console.error('Send message error details:', {
          message: err?.message,
          status: err?.status,
          data: err?.data,
        })
        throw err
      }
    },
    onSuccess: () => {
      setNewMessage('')
      queryClient.invalidateQueries({ queryKey: ['messages', trackingId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    onError: (error: any) => {
      console.error('Failed to send message:', error)
      // Show error in alert for debugging
      if (Platform.OS === 'web') {
        const errorMsg = error?.message || 'Unknown error'
        const statusCode = error?.status ? ` (Status: ${error.status})` : ''
        if (errorMsg === 'Failed to fetch') {
          alert('Failed to send message: Could not connect to server. Check browser console for details.')
        } else {
          alert(`Failed to send message: ${errorMsg}${statusCode}`)
        }
      }
    },
  })

  // Mark messages as read when viewing
  useEffect(() => {
    if (trackingId) {
      api.messagesAPI.markAllAsRead(trackingId).catch(() => {
        // Ignore errors - not critical
      })
    }
  }, [trackingId])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const handleSend = () => {
    if (!newMessage.trim()) return
    sendMessageMutation.mutate(newMessage.trim())
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return t('time.today')
    } else if (date.toDateString() === yesterday.toDateString()) {
      return t('time.yesterday')
    }
    return date.toLocaleDateString()
  }

  const renderMessage = ({ item, index }: { item: MessageResponse; index: number }) => {
    const isOwnMessage = item.sender_id === user?.id
    const messages = messagesData?.data.messages || []

    // Check if we should show date separator
    const showDateSeparator = index === 0 ||
      formatDate(item.created_at) !== formatDate(messages[index - 1]?.created_at)

    return (
      <>
        {showDateSeparator && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>{formatDate(item.created_at)}</Text>
          </View>
        )}
        <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
          <View style={[styles.messageBubble, isOwnMessage ? styles.ownMessage : styles.otherMessage]}>
            {!isOwnMessage && (
              <Text style={styles.senderName}>{item.sender_name}</Text>
            )}
            <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      </>
    )
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('common.error')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const messages = messagesData?.data.messages || []

  return (
    <>
      <Stack.Screen
        options={{
          title: t('messages.conversation'),
          headerBackTitle: t('common.back'),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('messages.noMessages')}</Text>
              <Text style={styles.emptySubtext}>{t('messages.startConversation')}</Text>
            </View>
          }
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false })
            }
          }}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder={t('messages.typeMessage')}
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendButtonText}>{t('messages.send')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorText: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    color: '#6b7280',
  },
  messageContainer: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  ownMessage: {
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#111',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#111',
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
})
