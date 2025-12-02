import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import { api, setAuthToken, clearAuthToken } from '@/services/api'
import type { UserResponse } from '@chaski/shared-types'

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
      const token = await SecureStore.getItemAsync(TOKEN_KEY)
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
    const response = await api.authAPI.login({ email, password })

    // Backend returns token in response for mobile
    // For web, it uses cookies - for mobile, we extract the token
    const token = (response.data as unknown as { access_token?: string }).access_token
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token)
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
      await SecureStore.deleteItemAsync(TOKEN_KEY)
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
