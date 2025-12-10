import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Stack } from 'expo-router'
import { useState } from 'react'

interface FAQItem {
  questionKey: string
  answerKey: string
}

interface FAQSection {
  titleKey: string
  items: FAQItem[]
}

export default function FAQScreen() {
  const { t } = useTranslation()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const faqSections: FAQSection[] = [
    {
      titleKey: 'faq.sections.general.title',
      items: [
        { questionKey: 'faq.sections.general.q1', answerKey: 'faq.sections.general.a1' },
        { questionKey: 'faq.sections.general.q2', answerKey: 'faq.sections.general.a2' },
        { questionKey: 'faq.sections.general.q3', answerKey: 'faq.sections.general.a3' },
      ],
    },
    {
      titleKey: 'faq.sections.senders.title',
      items: [
        { questionKey: 'faq.sections.senders.q1', answerKey: 'faq.sections.senders.a1' },
        { questionKey: 'faq.sections.senders.q2', answerKey: 'faq.sections.senders.a2' },
        { questionKey: 'faq.sections.senders.q3', answerKey: 'faq.sections.senders.a3' },
      ],
    },
    {
      titleKey: 'faq.sections.couriers.title',
      items: [
        { questionKey: 'faq.sections.couriers.q1', answerKey: 'faq.sections.couriers.a1' },
        { questionKey: 'faq.sections.couriers.q2', answerKey: 'faq.sections.couriers.a2' },
        { questionKey: 'faq.sections.couriers.q3', answerKey: 'faq.sections.couriers.a3' },
      ],
    },
    {
      titleKey: 'faq.sections.payments.title',
      items: [
        { questionKey: 'faq.sections.payments.q1', answerKey: 'faq.sections.payments.a1' },
        { questionKey: 'faq.sections.payments.q2', answerKey: 'faq.sections.payments.a2' },
      ],
    },
    {
      titleKey: 'faq.sections.safety.title',
      items: [
        { questionKey: 'faq.sections.safety.q1', answerKey: 'faq.sections.safety.a1' },
        { questionKey: 'faq.sections.safety.q2', answerKey: 'faq.sections.safety.a2' },
      ],
    },
  ]

  const toggleItem = (key: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('help.faq'),
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('faq.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('faq.subtitle')}</Text>
        </View>

        {faqSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>

            {section.items.map((item, itemIndex) => {
              const itemKey = `${sectionIndex}-${itemIndex}`
              const isExpanded = expandedItems.has(itemKey)

              return (
                <TouchableOpacity
                  key={itemKey}
                  style={styles.faqItem}
                  onPress={() => toggleItem(itemKey)}
                  activeOpacity={0.7}
                >
                  <View style={styles.questionRow}>
                    <Text style={styles.questionText}>{t(item.questionKey)}</Text>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#6b7280"
                    />
                  </View>
                  {isExpanded && (
                    <Text style={styles.answerText}>{t(item.answerKey)}</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('faq.moreHelp')}</Text>
          <Text style={styles.footerEmail}>support@mychaski.com</Text>
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
  header: {
    backgroundColor: '#fff',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
  },
  faqItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  questionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 22,
  },
  answerText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 22,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  footerEmail: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
})
