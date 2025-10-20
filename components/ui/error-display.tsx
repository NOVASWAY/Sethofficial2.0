import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  AlertTriangle, 
  RefreshCw, 
  Wifi, 
  Shield, 
  FileX, 
  Server, 
  AlertCircle,
  X
} from "lucide-react"
import { AppError, ERROR_TYPES } from "@/lib/error-handler"
import { cn } from "@/lib/utils"

interface ErrorDisplayProps {
  error: AppError | string | null
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  variant?: 'inline' | 'card' | 'fullscreen'
  showRetry?: boolean
  showDismiss?: boolean
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className,
  variant = 'inline',
  showRetry = true,
  showDismiss = false
}: ErrorDisplayProps) {
  if (!error) return null

  const errorMessage = typeof error === 'string' ? error : error.message
  const errorCode = typeof error === 'string' ? 'UNKNOWN' : error.code

  const getErrorIcon = (code: string) => {
    switch (code) {
      case ERROR_TYPES.NETWORK:
        return <Wifi className="h-4 w-4" />
      case ERROR_TYPES.AUTHENTICATION:
      case ERROR_TYPES.AUTHORIZATION:
        return <Shield className="h-4 w-4" />
      case ERROR_TYPES.NOT_FOUND:
        return <FileX className="h-4 w-4" />
      case ERROR_TYPES.SERVER:
        return <Server className="h-4 w-4" />
      case ERROR_TYPES.VALIDATION:
        return <AlertCircle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getErrorTitle = (code: string) => {
    switch (code) {
      case ERROR_TYPES.NETWORK:
        return 'Connection Error'
      case ERROR_TYPES.VALIDATION:
        return 'Validation Error'
      case ERROR_TYPES.AUTHENTICATION:
        return 'Authentication Required'
      case ERROR_TYPES.AUTHORIZATION:
        return 'Access Denied'
      case ERROR_TYPES.NOT_FOUND:
        return 'Not Found'
      case ERROR_TYPES.SERVER:
        return 'Server Error'
      default:
        return 'Error'
    }
  }

  const getErrorDescription = (code: string, message: string) => {
    switch (code) {
      case ERROR_TYPES.NETWORK:
        return 'Please check your internet connection and try again.'
      case ERROR_TYPES.AUTHENTICATION:
        return 'Please log in again to continue.'
      case ERROR_TYPES.AUTHORIZATION:
        return 'You do not have permission to perform this action.'
      case ERROR_TYPES.NOT_FOUND:
        return 'The requested resource could not be found.'
      case ERROR_TYPES.SERVER:
        return 'Something went wrong on our end. Please try again later.'
      default:
        return message
    }
  }

  const content = (
    <Alert variant="destructive" className={cn("", className)}>
      <div className="flex items-start gap-3">
        {getErrorIcon(errorCode)}
        <div className="flex-1">
          <AlertTitle>{getErrorTitle(errorCode)}</AlertTitle>
          <AlertDescription>
            {getErrorDescription(errorCode, errorMessage)}
          </AlertDescription>
          {(showRetry && onRetry) && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-8"
              >
                <RefreshCw className="h-3 w-3 mr-2" />
                Try Again
              </Button>
            </div>
          )}
        </div>
        {showDismiss && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </Alert>
  )

  if (variant === 'card') {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            {getErrorIcon(errorCode)}
            {getErrorTitle(errorCode)}
          </CardTitle>
          <CardDescription>
            {getErrorDescription(errorCode, errorMessage)}
          </CardDescription>
        </CardHeader>
        {(showRetry && onRetry) && (
          <CardContent>
            <Button
              variant="outline"
              onClick={onRetry}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        )}
      </Card>
    )
  }

  if (variant === 'fullscreen') {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              {getErrorIcon(errorCode)}
            </div>
            <CardTitle className="text-xl">{getErrorTitle(errorCode)}</CardTitle>
            <CardDescription>
              {getErrorDescription(errorCode, errorMessage)}
            </CardDescription>
          </CardHeader>
          {(showRetry && onRetry) && (
            <CardContent className="space-y-4">
              <Button
                onClick={onRetry}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              {onDismiss && (
                <Button
                  variant="outline"
                  onClick={onDismiss}
                  className="w-full"
                >
                  Dismiss
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    )
  }

  return content
}

// Specialized error components for common scenarios
export function NetworkError({ onRetry, onDismiss }: { onRetry?: () => void; onDismiss?: () => void }) {
  return (
    <ErrorDisplay
      error={{
        code: ERROR_TYPES.NETWORK,
        message: 'Network connection error',
        timestamp: new Date().toISOString()
      }}
      onRetry={onRetry}
      onDismiss={onDismiss}
      variant="card"
    />
  )
}

export function ValidationError({ errors, onRetry }: { errors: any[]; onRetry?: () => void }) {
  return (
    <ErrorDisplay
      error={{
        code: ERROR_TYPES.VALIDATION,
        message: 'Please correct the following errors',
        details: { validationErrors: errors },
        timestamp: new Date().toISOString()
      }}
      onRetry={onRetry}
      variant="card"
    />
  )
}

export function ServerError({ onRetry, onDismiss }: { onRetry?: () => void; onDismiss?: () => void }) {
  return (
    <ErrorDisplay
      error={{
        code: ERROR_TYPES.SERVER,
        message: 'Server error occurred',
        timestamp: new Date().toISOString()
      }}
      onRetry={onRetry}
      onDismiss={onDismiss}
      variant="card"
    />
  )
}
