'use client'

import React, { Component, ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  Server, 
  Database, 
  Shield, 
  Clock,
  HelpCircle,
  X
} from 'lucide-react'
import { APIError } from '@/lib/api-client'

interface ErrorInfo {
  componentStack: string
  errorBoundary?: string
  errorBoundaryStack?: string
  errorBoundaryComponentStack?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  retryCount: number
  lastErrorTime: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  maxRetries?: number
  retryDelay?: number
  showRetryButton?: boolean
  showErrorDetails?: boolean
}

interface ErrorDisplayProps {
  error: Error
  retryCount: number
  onRetry: () => void
  onDismiss: () => void
  showRetryButton?: boolean
  showErrorDetails?: boolean
}

function getErrorIcon(error: Error) {
  if (error instanceof APIError) {
    switch (error.status) {
      case 0:
        return <Wifi className="h-5 w-5" />
      case 500:
      case 502:
      case 503:
      case 504:
        return <Server className="h-5 w-5" />
      case 401:
      case 403:
        return <Shield className="h-5 w-5" />
      case 404:
        return <Database className="h-5 w-5" />
      default:
        return <AlertTriangle className="h-5 w-5" />
    }
  }
  return <AlertTriangle className="h-5 w-5" />
}

function getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
  if (error instanceof APIError) {
    if (error.status === 0) return 'medium' // Network error
    if (error.status >= 500) return 'critical' // Server error
    if (error.status >= 400) return 'high' // Client error
    return 'low'
  }
  return 'high'
}

function getErrorTitle(error: Error): string {
  if (error instanceof APIError) {
    switch (error.status) {
      case 0:
        return 'Network Connection Error'
      case 401:
        return 'Authentication Required'
      case 403:
        return 'Access Denied'
      case 404:
        return 'Resource Not Found'
      case 422:
        return 'Validation Error'
      case 429:
        return 'Rate Limit Exceeded'
      case 500:
        return 'Internal Server Error'
      case 502:
        return 'Bad Gateway'
      case 503:
        return 'Service Unavailable'
      case 504:
        return 'Gateway Timeout'
      default:
        return 'API Error'
    }
  }
  return 'Application Error'
}

function getErrorDescription(error: Error): string {
  if (error instanceof APIError) {
    switch (error.status) {
      case 0:
        return 'Unable to connect to the server. Please check your internet connection and try again.'
      case 401:
        return 'Your session has expired. Please log in again to continue.'
      case 403:
        return 'You do not have permission to access this resource. Contact your administrator if you believe this is an error.'
      case 404:
        return 'The requested resource could not be found. It may have been moved or deleted.'
      case 422:
        return 'The data you provided is invalid. Please check your input and try again.'
      case 429:
        return 'Too many requests. Please wait a moment before trying again.'
      case 500:
        return 'An internal server error occurred. Our team has been notified and is working to fix this issue.'
      case 502:
        return 'The server is temporarily unavailable. Please try again in a few moments.'
      case 503:
        return 'The service is currently under maintenance. Please try again later.'
      case 504:
        return 'The request timed out. Please try again.'
      default:
        return error.message || 'An unexpected error occurred. Please try again.'
    }
  }
  return error.message || 'An unexpected error occurred. Please try again.'
}

function getErrorActions(error: Error): Array<{ label: string; action: string; variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' }> {
  if (error instanceof APIError) {
    switch (error.status) {
      case 0:
        return [
          { label: 'Retry', action: 'retry', variant: 'default' },
          { label: 'Check Connection', action: 'check-connection', variant: 'outline' }
        ]
      case 401:
        return [
          { label: 'Login Again', action: 'login', variant: 'default' }
        ]
      case 403:
        return [
          { label: 'Contact Admin', action: 'contact-admin', variant: 'outline' }
        ]
      case 404:
        return [
          { label: 'Go Back', action: 'go-back', variant: 'outline' },
          { label: 'Refresh', action: 'refresh', variant: 'default' }
        ]
      case 422:
        return [
          { label: 'Fix Data', action: 'fix-data', variant: 'default' }
        ]
      case 429:
        return [
          { label: 'Wait & Retry', action: 'wait-retry', variant: 'outline' }
        ]
      case 500:
      case 502:
      case 503:
      case 504:
        return [
          { label: 'Retry', action: 'retry', variant: 'default' },
          { label: 'Report Issue', action: 'report-issue', variant: 'outline' }
        ]
      default:
        return [
          { label: 'Retry', action: 'retry', variant: 'default' }
        ]
    }
  }
  return [
    { label: 'Retry', action: 'retry', variant: 'default' },
    { label: 'Reload Page', action: 'reload', variant: 'outline' }
  ]
}

function ErrorDisplay({ 
  error, 
  retryCount, 
  onRetry, 
  onDismiss, 
  showRetryButton = true,
  showErrorDetails = false 
}: ErrorDisplayProps) {
  const severity = getErrorSeverity(error)
  const title = getErrorTitle(error)
  const description = getErrorDescription(error)
  const actions = getErrorActions(error)
  const icon = getErrorIcon(error)

  const severityColors = {
    low: 'border-blue-500 bg-blue-50 text-blue-900',
    medium: 'border-yellow-500 bg-yellow-50 text-yellow-900',
    high: 'border-orange-500 bg-orange-50 text-orange-900',
    critical: 'border-red-500 bg-red-50 text-red-900'
  }

  const severityBadgeColors = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800'
  }

  const handleAction = (action: string) => {
    switch (action) {
      case 'retry':
        onRetry()
        break
      case 'login':
        window.location.href = '/login'
        break
      case 'go-back':
        window.history.back()
        break
      case 'refresh':
        window.location.reload()
        break
      case 'reload':
        window.location.reload()
        break
      case 'check-connection':
        // Could implement connection check logic
        onRetry()
        break
      case 'contact-admin':
        // Could open contact form or email
        window.open('mailto:admin@clinic.com?subject=Access Issue', '_blank')
        break
      case 'fix-data':
        // Could scroll to form or highlight errors
        onRetry()
        break
      case 'wait-retry':
        setTimeout(() => onRetry(), 5000)
        break
      case 'report-issue':
        window.open('mailto:support@clinic.com?subject=System Error', '_blank')
        break
      default:
        onRetry()
    }
  }

  return (
    <Card className={`border-2 ${severityColors[severity]}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={severityBadgeColors[severity]}>
            {severity.toUpperCase()}
          </Badge>
          {retryCount > 0 && (
            <Badge variant="outline">
              Retry {retryCount}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <AlertDescription className="text-sm">
          {description}
        </AlertDescription>

        {showErrorDetails && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              Technical Details
            </summary>
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono">
              <div><strong>Error:</strong> {error.name}</div>
              <div><strong>Message:</strong> {error.message}</div>
              {error instanceof APIError && (
                <>
                  <div><strong>Status:</strong> {error.status}</div>
                  <div><strong>Code:</strong> {error.code || 'N/A'}</div>
                </>
              )}
              <div><strong>Time:</strong> {new Date().toLocaleString()}</div>
            </div>
          </details>
        )}

        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || 'default'}
                size="sm"
                onClick={() => handleAction(action.action)}
                disabled={action.action === 'wait-retry'}
              >
                {action.action === 'wait-retry' && <Clock className="h-3 w-3 mr-1" />}
                {action.action === 'retry' && <RefreshCw className="h-3 w-3 mr-1" />}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export class EnhancedErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastErrorTime: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo)
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  handleRetry = () => {
    const { maxRetries = 3, retryDelay = 1000 } = this.props
    const { retryCount } = this.state

    if (retryCount >= maxRetries) {
      return
    }

    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1
    }))
  }

  handleDismiss = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    })
  }

  render() {
    const { 
      hasError, 
      error, 
      retryCount, 
      lastErrorTime 
    } = this.state
    const { 
      children, 
      fallback, 
      showRetryButton = true,
      showErrorDetails = false 
    } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Show error display
      return (
        <div className="p-4">
          <ErrorDisplay
            error={error}
            retryCount={retryCount}
            onRetry={this.handleRetry}
            onDismiss={this.handleDismiss}
            showRetryButton={showRetryButton}
            showErrorDetails={showErrorDetails}
          />
        </div>
      )
    }

    return children
  }
}

// Hook for handling API errors in functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)
  const [retryCount, setRetryCount] = React.useState(0)

  const handleError = React.useCallback((error: Error) => {
    setError(error)
    setRetryCount(prev => prev + 1)
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
    setRetryCount(0)
  }, [])

  const retry = React.useCallback(() => {
    setError(null)
  }, [])

  return {
    error,
    retryCount,
    handleError,
    clearError,
    retry,
    hasError: !!error
  }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}
