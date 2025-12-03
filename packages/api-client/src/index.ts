// API Client package exports

// Types
export type {
  HttpClient,
  HttpClientConfig,
  HttpResponse,
  RequestConfig,
  TokenStorage,
  ApiClientConfig,
} from './types'

// Client factory
export { createApiClient } from './client'
export type { ApiClient } from './client'

// Adapters - re-export for Metro compatibility
export { createFetchAdapter } from './adapters/fetch'
export { createAxiosAdapter } from './adapters/axios'

// Re-export all types from shared-types for convenience
export * from '@chaski/shared-types'
