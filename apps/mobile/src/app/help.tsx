import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Stack, useRouter } from 'expo-router'

interface HelpItem {
  icon: keyof typeof Ionicons.glyphMap
  titleKey: string
  descriptionKey: string
  action?: () => void
}

export default function HelpScreen() {
  const { t } = useTranslation()
  const router = useRouter()

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@mychaski.com')
  }

  const handleFAQ = () => {
    router.push('/faq')
  }

  const handleTerms = () => {
    router.push('/terms')
  }

  const handlePrivacy = () => {
    router.push('/privacy')
  }

  const helpItems: HelpItem[] = [
    {
      icon: 'help-circle-outline',
      titleKey: 'help.faq',
      descriptionKey: 'help.faqDescription',
      action: handleFAQ,
    },
    {
      icon: 'mail-outline',
      titleKey: 'help.contactSupport',
      descriptionKey: 'help.contactDescription',
      action: handleEmailSupport,
    },
    {
      icon: 'document-text-outline',
      titleKey: 'help.termsOfService',
      descriptionKey: 'help.termsDescription',
      action: handleTerms,
    },
    {
      icon: 'shield-checkmark-outline',
      titleKey: 'help.privacyPolicy',
      descriptionKey: 'help.privacyDescription',
      action: handlePrivacy,
    },
  ]

  return (
    <>
      <Stack.Screen
        options={{
          title: t('common.info'),
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView style={styles.container}>
        {/* About Section */}
        <View style={styles.section}>
          <View style={styles.aboutHeader}>
            <View style={styles.logoContainer}>
              <Ionicons name="cube" size={48} color="#3b82f6" />
            </View>
            <Text style={styles.appName}>MyChaski</Text>
            <Text style={styles.tagline}>Connecting senders with couriers</Text>
          </View>
        </View>

        {/* Help Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('help.title')}</Text>

          {helpItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.helpItem}
              onPress={item.action}
              disabled={!item.action}
            >
              <View style={styles.iconContainer}>
                <Ionicons name={item.icon} size={24} color="#3b82f6" />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{t(item.titleKey)}</Text>
                <Text style={styles.itemDescription}>{t(item.descriptionKey)}</Text>
              </View>
              {item.action && (
                <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('help.appInfo')}</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('common.version')}</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('help.buildNumber')}</Text>
            <Text style={styles.infoValue}>1</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} MyChaski. All rights reserved.
          </Text>
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
  aboutHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  infoRow: {
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
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
})
