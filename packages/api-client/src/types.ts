// HTTP Client types for platform-agnostic API

export interface HttpClientConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
}

export interface RequestConfig {
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean | undefined>
}

export interface HttpResponse<T = unknown> {
  data: T
  status: number
  headers: Record<string, string>
}

export interface HttpClient {
  get<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>
  post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
  put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
  patch<T>(url: string, data?: unknown, config?: RequestConfig): Promise<HttpResponse<T>>
  delete<T>(url: string, config?: RequestConfig): Promise<HttpResponse<T>>
  setHeader(name: string, value: string): void
  removeHeader(name: string): void
}

export interface TokenStorage {
  getAccessToken(): Promise<string | null>
  setAccessToken(token: string): Promise<void>
  removeAccessToken(): Promise<void>
  getRefreshToken?(): Promise<string | null>
  setRefreshToken?(token: string): Promise<void>
  removeRefreshToken?(): Promise<void>
}

export interface ApiClientConfig {
  httpClient: HttpClient
  tokenStorage?: TokenStorage
  onUnauthorized?: () => void
}
