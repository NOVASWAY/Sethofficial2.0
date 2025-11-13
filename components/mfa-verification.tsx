'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Shield, Clock } from 'lucide-react'
import { mfaAPI } from '@/lib/api-client'

interface MfaVerificationProps {
  sessionToken: string
  onVerified: (token: string, refreshToken: string, user: any) => void
  onCancel: () => void
}

export function MfaVerification({ sessionToken, onVerified, onCancel }: MfaVerificationProps) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [method, setMethod] = useState<'totp' | 'recovery_code'>('totp')
  const [error, setError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(600) // 10 minutes in seconds
  const [showRecoveryCode, setShowRecoveryCode] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (timeRemaining <= 0) {
      setError('Session expired. Please log in again.')
      setTimeout(() => {
        onCancel()
      }, 2000)
      return
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeRemaining, onCancel])

  // Check session status periodically
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await mfaAPI.getSession(sessionToken)
        if (response.data?.mfa_verified) {
          // Session already verified, redirect
          onCancel()
        }
      } catch (error) {
        console.error('Error checking session:', error)
      }
    }

    const interval = setInterval(checkSession, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [sessionToken, onCancel])

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('Please enter a verification code')
      return
    }

    if (method === 'totp' && code.length !== 6) {
      setError('TOTP code must be 6 digits')
      return
    }

    if (method === 'recovery_code' && code.length < 8) {
      setError('Recovery code must be at least 8 characters')
      return
    }

    setIsVerifying(true)
    setError(null)

    try {
      const response = await mfaAPI.verify(sessionToken, code, method)
      if (response.success && response.data) {
        onVerified(response.data.token, response.data.refresh_token, response.data.user)
      } else {
        setError(response.message || 'Verification failed. Please try again.')
      }
    } catch (error: any) {
      console.error('MFA verification error:', error)
      setError(
        error?.message || 
        'Invalid verification code. Please check your authenticator app or recovery code.'
      )
    } finally {
      setIsVerifying(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter the verification code from your authenticator app
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>Session expires in:</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-4 h-4" />
              {formatTime(timeRemaining)}
            </span>
          </div>

          {!showRecoveryCode ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp-code">Verification Code</Label>
                <Input
                  id="totp-code"
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(value)
                    setError(null)
                  }}
                  maxLength={6}
                  className="text-center text-2xl font-mono tracking-widest"
                  autoFocus
                  disabled={isVerifying}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <Button
                onClick={handleVerify}
                className="w-full"
                disabled={isVerifying || code.length !== 6}
              >
                {isVerifying ? 'Verifying...' : 'Verify'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => setShowRecoveryCode(true)}
                className="w-full text-sm"
                disabled={isVerifying}
              >
                Use Recovery Code Instead
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-code">Recovery Code</Label>
                <Input
                  id="recovery-code"
                  type="text"
                  placeholder="ABCD1234"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    setCode(value)
                    setError(null)
                  }}
                  className="text-center text-lg font-mono"
                  autoFocus
                  disabled={isVerifying}
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter one of your recovery codes
                </p>
              </div>

              <Button
                onClick={() => {
                  setMethod('recovery_code')
                  handleVerify()
                }}
                className="w-full"
                disabled={isVerifying || code.length < 8}
              >
                {isVerifying ? 'Verifying...' : 'Verify with Recovery Code'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => {
                  setShowRecoveryCode(false)
                  setCode('')
                  setMethod('totp')
                }}
                className="w-full text-sm"
                disabled={isVerifying}
              >
                Use Authenticator App Instead
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full"
            disabled={isVerifying}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

