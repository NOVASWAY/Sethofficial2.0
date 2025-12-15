'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield, User, Mail, Building } from 'lucide-react'

interface SetupData {
  username: string
  password: string
  confirmPassword: string
  name: string
  email: string
  department: string
}

export default function SetupPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [setupData, setSetupData] = useState<SetupData>({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: '',
    department: 'Administration'
  })

  // Allow users to skip setup and go to login
  const handleSkipSetup = () => {
    router.push('/')
  }

  const handleInputChange = (field: keyof SetupData, value: string) => {
    setSetupData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const validateForm = (): string | null => {
    if (!setupData.username || !setupData.password || !setupData.name || !setupData.email) {
      return 'All fields are required'
    }
    
    if (setupData.password !== setupData.confirmPassword) {
      return 'Passwords do not match'
    }
    
    if (setupData.password.length < 8) {
      return 'Password must be at least 8 characters long'
    }
    
    if (!setupData.email.includes('@')) {
      return 'Please enter a valid email address'
    }
    
    return null
  }

  const [validationStep, setValidationStep] = useState<'form' | 'database' | 'config' | 'complete'>('form')
  const [validationResults, setValidationResults] = useState<{
    database: boolean
    migrations: boolean
    config: boolean
  }>({
    database: false,
    migrations: false,
    config: false
  })

  const validateDatabase = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/auth/setup/validate-database', {
        method: 'GET',
      })
      const data = await response.json()
      return data.success === true
    } catch {
      return false
    }
  }

  const validateMigrations = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/auth/setup/validate-migrations', {
        method: 'GET',
      })
      const data = await response.json()
      return data.success === true
    } catch {
      return false
    }
  }

  const validateConfig = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/auth/setup/validate-config', {
        method: 'GET',
      })
      const data = await response.json()
      return data.success === true
    } catch {
      return false
    }
  }

  const handleValidation = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Validate database connection
      const dbValid = await validateDatabase()
      setValidationResults(prev => ({ ...prev, database: dbValid }))
      
      if (!dbValid) {
        setError('Database connection failed. Please check your database configuration.')
        setIsLoading(false)
        return
      }

      setValidationStep('database')
      
      // Validate migrations
      const migrationsValid = await validateMigrations()
      setValidationResults(prev => ({ ...prev, migrations: migrationsValid }))
      
      if (!migrationsValid) {
        setError('Database migrations not applied. Please run migrations first.')
        setIsLoading(false)
        return
      }

      setValidationStep('config')
      
      // Validate configuration
      const configValid = await validateConfig()
      setValidationResults(prev => ({ ...prev, config: configValid }))
      
      if (!configValid) {
        setError('Configuration validation failed. Please check your environment variables.')
        setIsLoading(false)
        return
      }

      // All validations passed, proceed with setup
      await handleSetup()
    } catch (error) {
      console.error('Validation error:', error)
      setError(error instanceof Error ? error.message : 'Validation failed. Please try again.')
      setIsLoading(false)
    }
  }

  const handleSetup = async () => {
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('http://localhost:8080/api/auth/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: setupData.username,
          password: setupData.password,
          name: setupData.name,
          email: setupData.email,
          department: setupData.department,
          role: 'admin' // Always admin for initial setup
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Setup failed')
      }

      setSuccess(true)
      setValidationStep('complete')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/')
      }, 3000)

    } catch (error) {
      console.error('Setup error:', error)
      setError(error instanceof Error ? error.message : 'Setup failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Setup Complete!</CardTitle>
            <CardDescription>
              Your admin account has been created successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              You will be redirected to the login page in a few seconds...
            </p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-between items-start mb-2">
            <Button 
              onClick={handleSkipSetup}
              variant="ghost"
              size="sm"
              className="text-sm"
            >
              ← Go to Login
            </Button>
            <div className="flex-1"></div>
          </div>
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">System Setup</CardTitle>
          <CardDescription>
            Create your initial administrator account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="username"
                type="text"
                placeholder="admin"
                value={setupData.username}
                onChange={(e) => handleInputChange('username', e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={setupData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="admin@clinic.com"
                value={setupData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <div className="relative">
              <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="department"
                type="text"
                placeholder="Administration"
                value={setupData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter a strong password"
              value={setupData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password *</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={setupData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              required
            />
          </div>

          <Button 
            onClick={handleSetup} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Create Admin Account'
            )}
          </Button>

          <div className="pt-4 border-t">
            <p className="text-sm text-center text-muted-foreground mb-2">
              Already have an account or want to use demo credentials?
            </p>
            <Button 
              onClick={handleSkipSetup}
              variant="outline"
              className="w-full"
              disabled={isLoading}
            >
              Skip Setup & Go to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
