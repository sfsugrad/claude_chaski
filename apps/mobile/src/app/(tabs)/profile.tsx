import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '@/contexts/AuthContext'

export default function ProfileScreen() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // Use browser confirm on web since Alert.alert doesn't work
      if (window.confirm(`${t('auth.logout')}?`)) {
        logout()
      }
    } else {
      Alert.alert(
        t('auth.logout'),
        t('common.confirm') + '?',
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('auth.logout'), onPress: logout, style: 'destructive' },
        ]
      )
    }
  }

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      sender: t('auth.sender'),
      courier: t('auth.courier'),
      both: t('auth.both'),
      admin: t('admin.title'),
    }
    return labels[role] || role
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color="#9ca3af" />
        </View>
        <Text style={styles.name}>{user?.full_name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{getRoleLabel(user?.role || '')}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('profile.title')}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={20} color="#6b7280" />
          <Text style={styles.infoLabel}>{t('common.phone')}</Text>
          <Text style={styles.infoValue}>
            {user?.phone_number || t('common.emptyState')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="star-outline" size={20} color="#6b7280" />
          <Text style={styles.infoLabel}>{t('dashboard.averageRating')}</Text>
          <Text style={styles.infoValue}>
            {user?.average_rating?.toFixed(1) || '-'} ({user?.total_ratings || 0})
          </Text>
        </View>

        <View style={styles.verificationRow}>
          <View style={styles.verificationItem}>
            <Ionicons
              name={user?.is_verified ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={user?.is_verified ? '#22c55e' : '#ef4444'}
            />
            <Text style={styles.verificationLabel}>Email</Text>
          </View>
          <View style={styles.verificationItem}>
            <Ionicons
              name={user?.phone_verified ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={user?.phone_verified ? '#22c55e' : '#ef4444'}
            />
            <Text style={styles.verificationLabel}>{t('common.phone')}</Text>
          </View>
          {(user?.role === 'courier' || user?.role === 'both') && (
            <View style={styles.verificationItem}>
              <Ionicons
                name={user?.id_verified ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={user?.id_verified ? '#22c55e' : '#ef4444'}
              />
              <Text style={styles.verificationLabel}>ID</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color="#374151" />
          <Text style={styles.menuLabel}>{t('nav.settings')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/reviews')}>
          <Ionicons name="star-outline" size={24} color="#374151" />
          <Text style={styles.menuLabel}>{t('nav.reviews')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/help')}>
          <Ionicons name="help-circle-outline" size={24} color="#374151" />
          <Text style={styles.menuLabel}>{t('common.info')}</Text>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        <Text style={styles.logoutText}>{t('auth.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  profileHeader: {
    backgroundColor: '#fff',
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  roleBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  infoValue: {
    fontSize: 14,
    color: '#6b7280',
  },
  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  verificationItem: {
    alignItems: 'center',
    gap: 4,
  },
  verificationLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 48,
    padding: 16,
  },
  logoutText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
})
