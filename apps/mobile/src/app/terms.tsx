import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Stack } from 'expo-router'

interface Section {
  titleKey: string
  contentKey?: string
  introKey?: string
  items?: string[]
  additionalContent?: { key: string; titleKey?: string }[]
}

export default function TermsScreen() {
  const { t } = useTranslation()

  const sections: Section[] = [
    {
      titleKey: 'legal.terms.section1Title',
      contentKey: 'legal.terms.section1Content',
    },
    {
      titleKey: 'legal.terms.section2Title',
      contentKey: 'legal.terms.section2Content',
      additionalContent: [
        { key: 'legal.terms.section2DoesNot' },
        { key: 'legal.terms.section2Item1' },
        { key: 'legal.terms.section2Item2' },
        { key: 'legal.terms.section2Item3' },
        { key: 'legal.terms.section2Item4' },
        { key: 'legal.terms.section2Item5' },
        { key: 'legal.terms.section2NotCarrier' },
        { key: 'legal.terms.section2NoGuarantee' },
      ],
    },
    {
      titleKey: 'legal.terms.section3Title',
      introKey: 'legal.terms.section3Intro',
      items: [
        'legal.terms.section3Item1',
        'legal.terms.section3Item2',
        'legal.terms.section3Item3',
        'legal.terms.section3Item4',
      ],
    },
    {
      titleKey: 'legal.terms.section4Title',
      introKey: 'legal.terms.section4Intro',
      items: [
        'legal.terms.section4Item1',
        'legal.terms.section4Item2',
        'legal.terms.section4Item3',
        'legal.terms.section4Item4',
      ],
      additionalContent: [{ key: 'legal.terms.section4Suspension' }],
    },
    {
      titleKey: 'legal.terms.section5Title',
      introKey: 'legal.terms.section5Intro',
      items: [
        'legal.terms.section5Item1',
        'legal.terms.section5Item2',
        'legal.terms.section5Item3',
        'legal.terms.section5Item4',
        'legal.terms.section5Item5',
      ],
      additionalContent: [
        { key: 'legal.terms.section5Failure' },
        { key: 'legal.terms.section5NoGuarantee' },
      ],
    },
    {
      titleKey: 'legal.terms.section6Title',
      introKey: 'legal.terms.section6Intro',
      items: [
        'legal.terms.section6Item1',
        'legal.terms.section6Item2',
        'legal.terms.section6Item3',
        'legal.terms.section6Item4',
      ],
      additionalContent: [
        { key: 'legal.terms.section6NoInsurance' },
        { key: 'legal.terms.section6TaxResponsibility' },
      ],
    },
    {
      titleKey: 'legal.terms.section7Title',
      introKey: 'legal.terms.section7Intro',
      items: [
        'legal.terms.section7Item1',
        'legal.terms.section7Item2',
        'legal.terms.section7Item3',
        'legal.terms.section7Item4',
        'legal.terms.section7Item5',
        'legal.terms.section7Item6',
        'legal.terms.section7Item7',
        'legal.terms.section7Item8',
        'legal.terms.section7Item9',
      ],
      additionalContent: [
        { key: 'legal.terms.section7MaxValue' },
        { key: 'legal.terms.section7Disclosure' },
      ],
    },
    {
      titleKey: 'legal.terms.section8Title',
      contentKey: 'legal.terms.section8Content',
      additionalContent: [
        { key: 'legal.terms.section8DoesNot' },
        { key: 'legal.terms.section8Item1' },
        { key: 'legal.terms.section8Item2' },
        { key: 'legal.terms.section8Item3' },
        { key: 'legal.terms.section8Item4' },
        { key: 'legal.terms.section8NoBailmentContent', titleKey: 'legal.terms.section8NoBailmentTitle' },
      ],
    },
    {
      titleKey: 'legal.terms.section9Title',
      additionalContent: [
        { key: 'legal.terms.section9Content1' },
        { key: 'legal.terms.section9Content2' },
        { key: 'legal.terms.section9FeesNonRefundable' },
      ],
    },
    {
      titleKey: 'legal.terms.section10Title',
      introKey: 'legal.terms.section10Intro',
      items: [
        'legal.terms.section10Item1',
        'legal.terms.section10Item2',
        'legal.terms.section10Item3',
        'legal.terms.section10Item4',
        'legal.terms.section10Item5',
        'legal.terms.section10Item6',
      ],
      additionalContent: [{ key: 'legal.terms.section10Violation' }],
    },
    {
      titleKey: 'legal.terms.section11Title',
      introKey: 'legal.terms.section11Intro',
      items: [
        'legal.terms.section11Item1',
        'legal.terms.section11Item2',
        'legal.terms.section11Item3',
      ],
      additionalContent: [{ key: 'legal.terms.section11Removal' }],
    },
    {
      titleKey: 'legal.terms.section12Title',
      introKey: 'legal.terms.section12Intro',
      items: [
        'legal.terms.section12Item1',
        'legal.terms.section12Item2',
      ],
    },
    {
      titleKey: 'legal.terms.section13Title',
      introKey: 'legal.terms.section13Intro',
      items: [
        'legal.terms.section13Item1',
        'legal.terms.section13Item2',
        'legal.terms.section13Item3',
        'legal.terms.section13Item4',
      ],
    },
    {
      titleKey: 'legal.terms.section14Title',
      contentKey: 'legal.terms.section14Content',
      items: [
        'legal.terms.section14Item1',
        'legal.terms.section14Item2',
      ],
    },
    {
      titleKey: 'legal.terms.section15Title',
      contentKey: 'legal.terms.section15Content',
    },
    {
      titleKey: 'legal.terms.section16Title',
      contentKey: 'legal.terms.section16Content',
    },
    {
      titleKey: 'legal.terms.section17Title',
      contentKey: 'legal.terms.section17Content',
    },
    {
      titleKey: 'legal.terms.section18Title',
      contentKey: 'legal.terms.section18Content',
    },
    {
      titleKey: 'legal.terms.section19Title',
      contentKey: 'legal.terms.section19Content',
    },
    {
      titleKey: 'legal.terms.section20Title',
      introKey: 'legal.terms.section20Intro',
      items: [
        'legal.terms.section20Item1',
        'legal.terms.section20Item2',
        'legal.terms.section20Item3',
      ],
    },
  ]

  return (
    <>
      <Stack.Screen
        options={{
          title: t('help.termsOfService'),
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('legal.terms.title')}</Text>
          <Text style={styles.version}>{t('legal.terms.version')}</Text>
        </View>

        {/* Sections */}
        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>

            {section.contentKey && (
              <Text style={styles.paragraph}>{t(section.contentKey)}</Text>
            )}

            {section.introKey && (
              <Text style={styles.paragraph}>{t(section.introKey)}</Text>
            )}

            {section.items && (
              <View style={styles.list}>
                {section.items.map((item, itemIndex) => (
                  <View key={itemIndex} style={styles.listItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.listText}>{t(item)}</Text>
                  </View>
                ))}
              </View>
            )}

            {section.additionalContent?.map((content, contentIndex) => (
              <View key={contentIndex}>
                {content.titleKey && (
                  <Text style={styles.subTitle}>{t(content.titleKey)}</Text>
                )}
                <Text style={styles.paragraph}>{t(content.key)}</Text>
              </View>
            ))}
          </View>
        ))}

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
  header: {
    backgroundColor: '#fff',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
    marginBottom: 12,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  list: {
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 8,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
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
