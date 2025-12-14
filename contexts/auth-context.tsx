"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { User, AuthState, LoginCredentials, authenticateUser, getStoredUser, storeAuthToken, removeAuthToken } from '@/lib/auth'

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<any>
  logout: () => void
  checkAuth: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  })

  const router = useRouter()

  // Define checkAuth first since it's used in useEffect - memoized to prevent recreation
  const checkAuth = useCallback(() => {
    try {
      const user = getStoredUser()
      setAuthState({
        user,
        isAuthenticated: !!user,
        isLoading: false,
        error: null
      })
    } catch (error) {
      // Silently handle errors during auth check
      console.error('Error checking auth:', error)
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      })
    }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await authenticateUser(credentials)

      // Check if MFA is required
      if (result && 'mfaRequired' in result && result.mfaRequired) {
        // Return result with MFA info - don't redirect yet
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: null
        }))
        return result
      }

      if (result && result.user && result.token) {
        storeAuthToken(result.token)
        setAuthState({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        })
        router.push(`/dashboard/${result.user.role}`)
        return result
      } else {
        throw new Error('Invalid login response')
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }))
      throw error
    }
  }, [router])

  const logout = useCallback(() => {
    removeAuthToken()
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    })
    router.push('/')
  }, [router])

  // Initialize auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Create context value - memoized to prevent recreation
  const value: AuthContextType = useMemo(() => ({
    ...authState,
    login,
    logout,
    checkAuth
  }), [authState, login, logout, checkAuth])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    // Return a safe default instead of throwing to prevent crashes
    console.warn('useAuth called outside AuthProvider, using default values')
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: async () => {
        throw new Error('AuthProvider not available')
      },
      logout: () => { },
      checkAuth: () => { }
    }
  }
  return context
}
