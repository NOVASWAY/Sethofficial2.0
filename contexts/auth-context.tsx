"use client"

import React, { createContext, useContext, ReactNode } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  username: string
  name: string
  role: string
  department: string
  email: string
  permissions?: string[]
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (credentials: { username: string; password: string }) => Promise<{ mfaRequired?: boolean; mfaSessionToken?: string } | void>
  logout: () => void
  checkAuth: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  const user: User | null = session?.user
    ? {
        id: (session.user as any).id || '',
        username: (session.user as any).username || '',
        name: session.user.name || '',
        role: (session.user as any).role || 'receptionist',
        department: (session.user as any).department || '',
        email: session.user.email || '',
      }
    : null

  const login = async (credentials: { username: string; password: string }) => {
    const result = await signIn('credentials', {
      username: credentials.username,
      password: credentials.password,
      redirect: false,
    })

    if (result?.error) {
      throw new Error('Invalid credentials')
    }
  }

  const logout = () => {
    signOut({ callbackUrl: '/' })
  }

  const checkAuth = () => {
    // NextAuth handles this automatically
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: status === 'authenticated',
        isLoading: status === 'loading',
        error: null,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      login: async () => { throw new Error('AuthProvider not available') },
      logout: () => {},
      checkAuth: () => {},
    }
  }
  return context
}
