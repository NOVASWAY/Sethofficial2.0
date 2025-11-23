"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Heart, AlertCircle, Settings } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export default function LoginPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)
  
  const { login, isLoading, error, isAuthenticated, user } = useAuth()

  // Check if system needs setup
  const checkSystemSetup = async () => {
    try {
      // Check if database is accessible - if it fails, setup is needed
      const response = await fetch('http://localhost:8080/api/test/database', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        // Database is accessible, assume setup is complete
        // In a real scenario, you might check if users exist
        setNeedsSetup(false)
      } else {
        // Database not accessible, setup is needed
        setNeedsSetup(true)
      }
    } catch (error) {
      // Silently handle error - don't log to avoid console noise
      // On error, assume setup is not needed (system is already set up)
      setNeedsSetup(false)
    } finally {
      setCheckingSetup(false)
    }
  }

  // Set mounted state and check setup
  useEffect(() => {
    setMounted(true)
    checkSystemSetup()
  }, [])

  // Redirect if already authenticated
  useEffect(() => {
    if (mounted && isAuthenticated && user) {
      router.push(`/dashboard/${user.role}`)
    }
  }, [mounted, isAuthenticated, user, router])

  // Redirect to setup if needed
  useEffect(() => {
    if (mounted && !checkingSetup && needsSetup) {
      router.push('/setup')
    }
  }, [mounted, checkingSetup, needsSetup, router])

  // Don't render until mounted and setup check is complete
  if (!mounted || checkingSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Checking system status...</p>
        </div>
      </div>
    )
  }

  const handleLogin = async () => {
    if (!credentials.username || !credentials.password) {
      setErrors({ form: 'Please enter your username and password' })
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      // Login with username and password - the auth system will determine the role
      const result = await login({
        username: credentials.username,
        password: credentials.password,
        role: '' // Role will be determined by the auth system
      })
      
      // Check if MFA is required
      if (result && 'mfaRequired' in result && result.mfaRequired && result.mfaSessionToken) {
        router.push(`/mfa-verify?session=${result.mfaSessionToken}`)
        return
      }
    } catch (error) {
      console.error('Login error:', error)
      setErrors({ form: 'Invalid credentials. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Seth Medical Clinic</h1>
          </div>
          <p className="text-muted-foreground">Management System</p>
        </div>

        {/* Login Card */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Sign In</CardTitle>
            <CardDescription className="text-center">Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={credentials.username}
                onChange={(e) => setCredentials((prev) => ({ ...prev, username: e.target.value }))}
                onKeyPress={handleKeyPress}
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={credentials.password}
                onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
                onKeyPress={handleKeyPress}
                autoComplete="current-password"
              />
            </div>

            {/* Error Display */}
            {(error || errors.form) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error || errors.form}</AlertDescription>
              </Alert>
            )}

            {/* Login Button */}
            <Button
              onClick={handleLogin}
              className="w-full"
              disabled={!credentials.username || !credentials.password || isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
