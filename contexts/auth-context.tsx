"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { User, AuthState, LoginCredentials, authenticateUser, getStoredUser, storeAuthToken, removeAuthToken } from '@/lib/auth'

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>
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

  const login = async (credentials: LoginCredentials) => {
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
  }

  const logout = () => {
    removeAuthToken()
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null
    })
    router.push('/')
  }

  const checkAuth = () => {
    const user = getStoredUser()
    setAuthState({
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null
    })
  }

  useEffect(() => {
    checkAuth()
  }, [])

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    checkAuth
  }

  return (
    <AuthContext.Provider value={value}>
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
