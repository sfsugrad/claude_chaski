import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { useRouter, Stack } from 'expo-router'
import { useState } from 'react'
import i18n from '@/utils/i18n'

export default function SettingsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [pushNotifications, setPushNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)

  const currentLanguage = i18n.language || 'en'

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
  ]

  const handleLanguageChange = () => {
    const options = languages.map(lang => ({
      text: lang.label,
      onPress: () => i18n.changeLanguage(lang.code),
    }))

    if (Platform.OS === 'web') {
      // Simple prompt for web
      const choice = window.prompt(
        `${t('language.select')}\n${languages.map((l, i) => `${i + 1}. ${l.label}`).join('\n')}\n\nEnter number (1-3):`,
        '1'
      )
      if (choice) {
        const index = parseInt(choice, 10) - 1
        if (index >= 0 && index < languages.length) {
          i18n.changeLanguage(languages[index].code)
        }
      }
    } else {
      Alert.alert(
        t('language.select'),
        undefined,
        [
          ...options,
          { text: t('common.cancel'), style: 'cancel' },
        ]
      )
    }
  }

  const getCurrentLanguageLabel = () => {
    return languages.find(l => l.code === currentLanguage)?.label || 'English'
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('nav.settings'),
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView style={styles.container}>
        {/* Language Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.preferredLanguage')}</Text>

          <TouchableOpacity style={styles.menuItem} onPress={handleLanguageChange}>
            <Ionicons name="language-outline" size={24} color="#374151" />
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>{t('language.select')}</Text>
              <Text style={styles.menuValue}>{getCurrentLanguageLabel()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notifications.preferences')}</Text>

          <View style={styles.switchItem}>
            <Ionicons name="notifications-outline" size={24} color="#374151" />
            <View style={styles.switchContent}>
              <Text style={styles.menuLabel}>{t('notifications.pushNotifications')}</Text>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={pushNotifications ? '#3b82f6' : '#f4f4f5'}
            />
          </View>

          <View style={styles.switchItem}>
            <Ionicons name="mail-outline" size={24} color="#374151" />
            <View style={styles.switchContent}>
              <Text style={styles.menuLabel}>{t('notifications.emailNotifications')}</Text>
            </View>
            <Switch
              value={emailNotifications}
              onValueChange={setEmailNotifications}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              thumbColor={emailNotifications ? '#3b82f6' : '#f4f4f5'}
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('common.info')}</Text>

          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>{t('common.version')}</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    color: '#374151',
  },
  menuValue: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  switchContent: {
    flex: 1,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 16,
    color: '#374151',
  },
  infoValue: {
    fontSize: 16,
    color: '#6b7280',
  },
})
