// Axios adapter for web platform (supports cookies, CSRF)
import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import type { HttpClient, HttpClientConfig, HttpResponse, RequestConfig } from '../types'

export interface AxiosAdapterConfig extends HttpClientConfig {
  withCredentials?: boolean
  getCsrfToken?: () => string | null
}

export function createAxiosAdapter(
  axiosInstance: AxiosInstance,
  config?: { getCsrfToken?: () => string | null }
): HttpClient {
  // Add CSRF interceptor if function provided
  if (config?.getCsrfToken) {
    axiosInstance.interceptors.request.use((requestConfig) => {
      if (['post', 'put', 'delete', 'patch'].includes(requestConfig.method?.toLowerCase() || '')) {
        const csrfToken = config.getCsrfToken!()
        if (csrfToken) {
          requestConfig.headers['X-CSRF-Token'] = csrfToken
        }
      }
      return requestConfig
    })
  }

  return {
    async get<T>(url: string, requestConfig?: RequestConfig): Promise<HttpResponse<T>> {
      const axiosConfig: AxiosRequestConfig = {
        headers: requestConfig?.headers,
        params: requestConfig?.params,
      }
      const response = await axiosInstance.get<T>(url, axiosConfig)
      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      }
    },

    async post<T>(url: string, data?: unknown, requestConfig?: RequestConfig): Promise<HttpResponse<T>> {
      const axiosConfig: AxiosRequestConfig = {
        headers: requestConfig?.headers,
        params: requestConfig?.params,
      }
      const response = await axiosInstance.post<T>(url, data, axiosConfig)
      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      }
    },

    async put<T>(url: string, data?: unknown, requestConfig?: RequestConfig): Promise<HttpResponse<T>> {
      const axiosConfig: AxiosRequestConfig = {
        headers: requestConfig?.headers,
        params: requestConfig?.params,
      }
      const response = await axiosInstance.put<T>(url, data, axiosConfig)
      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      }
    },

    async patch<T>(url: string, data?: unknown, requestConfig?: RequestConfig): Promise<HttpResponse<T>> {
      const axiosConfig: AxiosRequestConfig = {
        headers: requestConfig?.headers,
        params: requestConfig?.params,
      }
      const response = await axiosInstance.patch<T>(url, data, axiosConfig)
      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      }
    },

    async delete<T>(url: string, requestConfig?: RequestConfig): Promise<HttpResponse<T>> {
      const axiosConfig: AxiosRequestConfig = {
        headers: requestConfig?.headers,
        params: requestConfig?.params,
      }
      const response = await axiosInstance.delete<T>(url, axiosConfig)
      return {
        data: response.data,
        status: response.status,
        headers: response.headers as Record<string, string>,
      }
    },

    setHeader(name: string, value: string): void {
      axiosInstance.defaults.headers.common[name] = value
    },

    removeHeader(name: string): void {
      delete axiosInstance.defaults.headers.common[name]
    },
  }
}
