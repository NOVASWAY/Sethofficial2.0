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

// Demo credentials for quick access
const DEMO_CREDENTIALS = [
  { username: 'admin', password: 'demo123', role: 'admin', name: 'Demo Administrator' },
  { username: 'clinician', password: 'demo123', role: 'clinician', name: 'Demo Clinician' },
  { username: 'nurse', password: 'demo123', role: 'nurse', name: 'Demo Nurse' },
  { username: 'pharmacist', password: 'demo123', role: 'pharmacist', name: 'Demo Pharmacist' },
  { username: 'receptionist', password: 'demo123', role: 'receptionist', name: 'Demo Receptionist' },
  { username: 'labtech', password: 'demo123', role: 'lab_technician', name: 'Demo Lab Technician' },
]

export default function LoginPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [credentials, setCredentials] = useState({ username: "", password: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { login, isLoading, error, isAuthenticated, user } = useAuth()

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if already authenticated
  useEffect(() => {
    if (mounted && isAuthenticated && user) {
      router.push(`/dashboard/${user.role}`)
    }
  }, [mounted, isAuthenticated, user, router])

  // Don't render until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Safety check - ensure we're in browser environment
  if (typeof window === 'undefined') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Loading...</p>
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
      // Try backend login first
      try {
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
        
        // Success - redirect handled by auth context
        return
      } catch (backendError) {
        // Backend login failed, try demo credentials
        const demoUser = DEMO_CREDENTIALS.find(
          cred => cred.username === credentials.username && cred.password === credentials.password
        )
        
        if (demoUser) {
          // Create a mock user object and token for demo
          const mockUser = {
            id: `demo-${demoUser.username}`,
            username: demoUser.username,
            email: `${demoUser.username}@demo.sethmedical.com`,
            role: demoUser.role as any,
            name: demoUser.name,
            department: 'Demo Department',
            permissions: ['all'],
            avatar: '',
            is_active: true,
            lastLogin: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
          
          // Create a simple mock token (just base64 encoded user data)
          const mockToken = btoa(JSON.stringify({
            userId: mockUser.id,
            username: mockUser.username,
            role: mockUser.role,
            name: mockUser.name,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
          }))
          
          // Store demo auth data
          if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', mockToken)
            localStorage.setItem('user_data', JSON.stringify(mockUser))
            // Reload to ensure auth context picks up the new user
            window.location.href = `/dashboard/${demoUser.role}`
            return
          }
          
          // Fallback to router if window is not available
          router.push(`/dashboard/${demoUser.role}`)
          return
        }
        
        // Neither backend nor demo credentials worked
        throw backendError
      }
    } catch (error) {
      console.error('Login error:', error)
      setErrors({ form: 'Invalid credentials. Please try again or use demo credentials.' })
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleDemoLogin = (demoCred: typeof DEMO_CREDENTIALS[0]) => {
    setCredentials({ username: demoCred.username, password: demoCred.password })
    // Auto-submit after a brief moment
    setTimeout(() => {
      handleLogin()
    }, 100)
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

        {/* Demo Credentials Card */}
        <Card className="border-border/50 shadow-lg bg-muted/50">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="text-lg text-center">Demo Credentials</CardTitle>
            <CardDescription className="text-center text-xs">
              Click any role to login instantly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {DEMO_CREDENTIALS.map((cred) => (
                <Button
                  key={cred.username}
                  variant="outline"
                  size="sm"
                  onClick={() => handleDemoLogin(cred)}
                  disabled={isSubmitting}
                  className="text-xs"
                >
                  {cred.name}
                </Button>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              All demo accounts use password: <strong>demo123</strong>
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
