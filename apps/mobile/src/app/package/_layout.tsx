import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'

export default function PackageLayout() {
  const { t } = useTranslation()

  return (
    <Stack>
      <Stack.Screen
        name="create"
        options={{
          title: t('packages.createNew'),
          headerBackTitle: t('common.back'),
        }}
      />
      <Stack.Screen
        name="[trackingId]"
        options={{
          title: t('packages.packageDetails'),
          headerBackTitle: t('common.back'),
        }}
      />
    </Stack>
  )
}
