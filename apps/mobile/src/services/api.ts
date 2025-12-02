import { createApiClient } from '@chaski/api-client'
import { createFetchAdapter } from '@chaski/api-client/adapters/fetch'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8000'

// Token storage implementation for React Native
const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync('auth_token')
    } catch {
      return null
    }
  },
  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync('auth_token', token)
  },
  async removeAccessToken(): Promise<void> {
    await SecureStore.deleteItemAsync('auth_token')
  },
}

// Create fetch adapter with token storage
const httpClient = createFetchAdapter({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  tokenStorage,
  onUnauthorized: () => {
    // Handle unauthorized - the AuthContext will handle navigation
    console.log('Unauthorized - token may be expired')
  },
})

// Create API client
export const api = createApiClient(httpClient)

// Helper functions to set/clear auth token
export function setAuthToken(token: string) {
  httpClient.setHeader('Authorization', `Bearer ${token}`)
}

export function clearAuthToken() {
  httpClient.removeHeader('Authorization')
}

export default api
