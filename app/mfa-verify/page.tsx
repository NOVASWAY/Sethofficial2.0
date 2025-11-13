'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MfaVerification } from '@/components/mfa-verification'
import { useAuth } from '@/contexts/auth-context'

export default function MfaVerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [sessionToken, setSessionToken] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('session')
    if (!token) {
      router.push('/')
      return
    }
    setSessionToken(token)
  }, [searchParams, router])

  const handleVerified = (token: string, refreshToken: string, user: any) => {
    // Store tokens
    localStorage.setItem('auth_token', token)
    localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('user_data', JSON.stringify(user))
    
    // Redirect to dashboard
    router.push(`/dashboard/${user.role}`)
  }

  const handleCancel = () => {
    router.push('/')
  }

  if (!sessionToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <MfaVerification
      sessionToken={sessionToken}
      onVerified={handleVerified}
      onCancel={handleCancel}
    />
  )
}

