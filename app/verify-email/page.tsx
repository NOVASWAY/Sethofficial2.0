'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { authAPI } from '@/lib/api-client'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (!tokenParam) {
      setError('Invalid verification link. Please request a new verification email.')
      setIsVerifying(false)
      return
    }

    setToken(tokenParam)
    verifyEmail(tokenParam)
  }, [searchParams])

  const verifyEmail = async (tokenValue: string) => {
    setIsVerifying(true)
    setError(null)

    try {
      const response = await authAPI.verifyEmail(tokenValue)
      if (response.success) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/')
        }, 3000)
      } else {
        setError(response.message || 'Failed to verify email. The link may be invalid or expired.')
      }
    } catch (error: any) {
      console.error('Email verification error:', error)
      setError(error?.message || 'Failed to verify email. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    // This would require the email address, which we don't have
    // In a real implementation, you'd store the email in the token or ask the user
    router.push('/resend-verification')
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Verifying your email address...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <CardTitle>Email Verified!</CardTitle>
              <CardDescription>
                Your email address has been verified successfully. Redirecting to login...
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push('/')}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <CardTitle>Verification Failed</CardTitle>
            <CardDescription>
              {error || 'This verification link is invalid or has expired.'}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              You can request a new verification email if you need one.
            </AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button
              onClick={handleResend}
              variant="outline"
              className="flex-1"
            >
              Request New Verification Email
            </Button>
            <Button
              onClick={() => router.push('/')}
              variant="outline"
              className="flex-1"
            >
              Go to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

