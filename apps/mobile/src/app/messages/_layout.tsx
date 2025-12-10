import { Stack } from 'expo-router'
import { useTranslation } from 'react-i18next'

export default function MessagesLayout() {
  const { t } = useTranslation()

  return (
    <Stack>
      <Stack.Screen
        name="[trackingId]"
        options={{
          title: t('messages.conversation'),
          headerBackTitle: t('common.back'),
        }}
      />
    </Stack>
  )
}
