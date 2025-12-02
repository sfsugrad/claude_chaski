// Fetch adapter for React Native (supports Bearer token auth)
import type { HttpClient, HttpClientConfig, HttpResponse, RequestConfig, TokenStorage } from '../types'

export interface FetchAdapterConfig extends HttpClientConfig {
  tokenStorage?: TokenStorage
  onUnauthorized?: () => void
}

export function createFetchAdapter(config: FetchAdapterConfig): HttpClient {
  const { baseURL, timeout = 30000, headers: defaultHeaders = {}, tokenStorage, onUnauthorized } = config

  const customHeaders: Record<string, string> = { ...defaultHeaders }

  async function makeRequest<T>(
    method: string,
    url: string,
    data?: unknown,
    requestConfig?: RequestConfig
  ): Promise<HttpResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // Build URL with params
      let fullUrl = `${baseURL}${url}`
      if (requestConfig?.params) {
        const params = new URLSearchParams()
        Object.entries(requestConfig.params).forEach(([key, value]) => {
          if (value !== undefined) {
            params.append(key, String(value))
          }
        })
        const queryString = params.toString()
        if (queryString) {
          fullUrl += `?${queryString}`
        }
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...customHeaders,
        ...requestConfig?.headers,
      }

      // Add Bearer token if available
      if (tokenStorage) {
        const token = await tokenStorage.getAccessToken()
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
      }

      const fetchConfig: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      }

      if (data !== undefined && method !== 'GET') {
        fetchConfig.body = JSON.stringify(data)
      }

      const response = await fetch(fullUrl, fetchConfig)

      // Handle 401 Unauthorized
      if (response.status === 401) {
        if (tokenStorage) {
          await tokenStorage.removeAccessToken()
        }
        onUnauthorized?.()
      }

      // Parse response
      let responseData: T
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        responseData = await response.json()
      } else {
        responseData = (await response.text()) as unknown as T
      }

      // Throw on error status
      if (!response.ok) {
        const error = new Error(`HTTP Error ${response.status}`) as Error & {
          status: number
          data: T
        }
        error.status = response.status
        error.data = responseData
        throw error
      }

      // Convert headers to Record
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      return {
        data: responseData,
        status: response.status,
        headers: responseHeaders,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return {
    async get<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
      return makeRequest<T>('GET', url, undefined, config)
    },

    async post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>> {
      return makeRequest<T>('POST', url, data, config)
    },

    async put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>> {
      return makeRequest<T>('PUT', url, data, config)
    },

    async patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>> {
      return makeRequest<T>('PATCH', url, data, config)
    },

    async delete<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>> {
      return makeRequest<T>('DELETE', url, undefined, config)
    },

    setHeader(name: string, value: string): void {
      customHeaders[name] = value
    },

    removeHeader(name: string): void {
      delete customHeaders[name]
    },
  }
}
