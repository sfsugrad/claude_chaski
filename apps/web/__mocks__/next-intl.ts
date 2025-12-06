// Mock for next-intl

// Client-side hooks
export const useTranslations = jest.fn(() => (key: string) => key)
export const useLocale = jest.fn(() => 'en')
export const useMessages = jest.fn(() => ({}))
export const useNow = jest.fn(() => new Date())
export const useTimeZone = jest.fn(() => 'America/Los_Angeles')
export const useFormatter = jest.fn(() => ({
  dateTime: jest.fn((date: Date) => date.toISOString()),
  number: jest.fn((num: number) => String(num)),
  relativeTime: jest.fn((date: Date) => 'just now'),
}))

// Server-side functions (from next-intl/server)
export const getLocale = jest.fn(async () => 'en')
export const getMessages = jest.fn(async () => ({}))
export const getTranslations = jest.fn(async () => (key: string) => key)
export const getNow = jest.fn(async () => new Date())
export const getTimeZone = jest.fn(async () => 'America/Los_Angeles')
export const getFormatter = jest.fn(async () => ({
  dateTime: jest.fn((date: Date) => date.toISOString()),
  number: jest.fn((num: number) => String(num)),
  relativeTime: jest.fn((date: Date) => 'just now'),
}))
export const setRequestLocale = jest.fn()
// getRequestConfig is a higher-order function that takes a config function
export const getRequestConfig = jest.fn((configFn: any) => configFn)
export const getExtracted = jest.fn()

// Provider component
export const NextIntlClientProvider = ({ children }: { children: React.ReactNode }) => children
