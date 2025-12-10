import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Stack } from 'expo-router'

interface Section {
  titleKey: string
  contentKey?: string
  introKey?: string
  items?: string[]
  subSections?: {
    titleKey: string
    items?: string[]
    contentKey?: string
  }[]
  additionalContent?: { key: string; titleKey?: string }[]
}

export default function PrivacyScreen() {
  const { t } = useTranslation()

  const sections: Section[] = [
    {
      titleKey: 'legal.privacy.section1Title',
      contentKey: 'legal.privacy.section1Content',
    },
    {
      titleKey: 'legal.privacy.section2Title',
      subSections: [
        {
          titleKey: 'legal.privacy.section2_1Title',
          items: [
            'legal.privacy.section2_1Item1',
            'legal.privacy.section2_1Item2',
            'legal.privacy.section2_1Item3',
            'legal.privacy.section2_1Item4',
            'legal.privacy.section2_1Item5',
          ],
        },
        {
          titleKey: 'legal.privacy.section2_2Title',
          items: [
            'legal.privacy.section2_2Item1',
            'legal.privacy.section2_2Item2',
            'legal.privacy.section2_2Item3',
            'legal.privacy.section2_2Item4',
          ],
        },
      ],
      additionalContent: [
        { key: 'legal.privacy.section2_2GPSContent', titleKey: 'legal.privacy.section2_2GPSTitle' },
      ],
    },
    {
      titleKey: 'legal.privacy.section3Title',
      introKey: 'legal.privacy.section3Intro',
      items: [
        'legal.privacy.section3Item1',
        'legal.privacy.section3Item2',
        'legal.privacy.section3Item3',
        'legal.privacy.section3Item4',
        'legal.privacy.section3Item5',
        'legal.privacy.section3Item6',
        'legal.privacy.section3Item7',
        'legal.privacy.section3Item8',
      ],
      additionalContent: [
        { key: 'legal.privacy.section3Messaging', titleKey: 'legal.privacy.section3MessagingTitle' },
        { key: 'legal.privacy.section3Anonymized', titleKey: 'legal.privacy.section3AnonymizedTitle' },
      ],
    },
    {
      titleKey: 'legal.privacy.section4Title',
      introKey: 'legal.privacy.section4Intro',
      items: [
        'legal.privacy.section4Item1',
        'legal.privacy.section4Item2',
        'legal.privacy.section4Item3',
        'legal.privacy.section4Item4',
      ],
      additionalContent: [{ key: 'legal.privacy.section4NoSell' }],
    },
    {
      titleKey: 'legal.privacy.section5Title',
      introKey: 'legal.privacy.section5Intro',
      items: [
        'legal.privacy.section5Item1',
        'legal.privacy.section5Item2',
        'legal.privacy.section5Item3',
        'legal.privacy.section5Item4',
        'legal.privacy.section5Item5',
      ],
      additionalContent: [
        { key: 'legal.privacy.section5Storage', titleKey: 'legal.privacy.section5StorageTitle' },
      ],
    },
    {
      titleKey: 'legal.privacy.section6Title',
      contentKey: 'legal.privacy.section6Content',
    },
    {
      titleKey: 'legal.privacy.section7Title',
      introKey: 'legal.privacy.section7Intro',
      items: [
        'legal.privacy.section7Item1',
        'legal.privacy.section7Item2',
        'legal.privacy.section7Item3',
        'legal.privacy.section7Item4',
        'legal.privacy.section7Item5',
      ],
      additionalContent: [{ key: 'legal.privacy.section7Contact' }],
    },
    {
      titleKey: 'legal.privacy.section8Title',
      contentKey: 'legal.privacy.section8Content',
    },
    {
      titleKey: 'legal.privacy.section9Title',
      contentKey: 'legal.privacy.section9Content',
    },
    {
      titleKey: 'legal.privacy.section10Title',
      contentKey: 'legal.privacy.section10Content',
    },
    {
      titleKey: 'legal.privacy.section11Title',
      introKey: 'legal.privacy.section11Intro',
      additionalContent: [{ key: 'legal.privacy.section11Email' }],
    },
  ]

  return (
    <>
      <Stack.Screen
        options={{
          title: t('help.privacyPolicy'),
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('legal.privacy.title')}</Text>
          <Text style={styles.version}>{t('legal.privacy.version')}</Text>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>{t('legal.privacy.friendlySummary')}</Text>
          </View>
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

            {section.subSections?.map((subSection, subIndex) => (
              <View key={subIndex} style={styles.subSection}>
                <Text style={styles.subTitle}>{t(subSection.titleKey)}</Text>
                {subSection.contentKey && (
                  <Text style={styles.paragraph}>{t(subSection.contentKey)}</Text>
                )}
                {subSection.items && (
                  <View style={styles.list}>
                    {subSection.items.map((item, itemIndex) => (
                      <View key={itemIndex} style={styles.listItem}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.listText}>{t(item)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

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

        {/* Contact Email */}
        <View style={styles.contactSection}>
          <Text style={styles.contactEmail}>privacy@mychaski.com</Text>
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
    marginBottom: 16,
  },
  summaryBox: {
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  summaryText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
    fontStyle: 'italic',
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
  subSection: {
    marginTop: 12,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
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
  contactSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 16,
    alignItems: 'center',
  },
  contactEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
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
