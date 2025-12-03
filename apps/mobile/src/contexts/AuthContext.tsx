import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Platform } from 'react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { api, setAuthToken, clearAuthToken } from '@/services/api'
import type { UserResponse } from '@chaski/shared-types'

// Platform-specific token storage
const tokenStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key)
    }
    return SecureStore.getItemAsync(key)
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value)
      return
    }
    await SecureStore.setItemAsync(key, value)
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key)
      return
    }
    await SecureStore.deleteItemAsync(key)
  },
}

interface AuthContextType {
  user: UserResponse | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'auth_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStoredAuth()
  }, [])

  const loadStoredAuth = async () => {
    try {
      const token = await tokenStorage.getItem(TOKEN_KEY)
      if (token) {
        setAuthToken(token)
        await refreshUser()
      }
    } catch (error) {
      console.error('Failed to load auth:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    // Use mobile-specific login endpoint that returns token in response body
    const response = await api.authAPI.loginMobile({ email, password })

    // Store the token in storage
    const token = response.data.access_token
    if (token) {
      await tokenStorage.setItem(TOKEN_KEY, token)
      setAuthToken(token)
    }

    await refreshUser()
  }

  const logout = async () => {
    try {
      await api.authAPI.logout()
    } catch (error) {
      console.error('Logout API error:', error)
    } finally {
      await tokenStorage.deleteItem(TOKEN_KEY)
      clearAuthToken()
      setUser(null)
      router.replace('/(auth)/login')
    }
  }

  const refreshUser = async () => {
    try {
      const response = await api.authAPI.getCurrentUser()
      setUser(response.data)
    } catch (error) {
      console.error('Failed to fetch user:', error)
      await logout()
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
