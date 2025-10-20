import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { APIError } from '@/lib/api-client'
import { activityLogAPI } from '@/lib/api-client'
import { useAuth } from '@/contexts/auth-context'

interface ErrorContext {
  component: string
  action: string
  timestamp: number
  userAgent: string
  url: string
  userId?: string
  role?: string
  department?: string
}

interface ErrorReport {
  id: string
  error: Error
  context: ErrorContext
  retryCount: number
  resolved: boolean
  resolvedAt?: number
}

interface UseEnhancedErrorHandlingOptions {
  enableActivityLogging?: boolean
  enableErrorReporting?: boolean
  maxRetries?: number
  retryDelay?: number
  showToastOnError?: boolean
  component?: string
}

export function useEnhancedErrorHandling(options: UseEnhancedErrorHandlingOptions = {}) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [errors, setErrors] = useState<ErrorReport[]>([])
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  const {
    enableActivityLogging = true,
    enableErrorReporting = true,
    maxRetries = 3,
    retryDelay = 1000,
    showToastOnError = true,
    component = 'unknown'
  } = options

  // Create error context
  const createErrorContext = useCallback((action: string): ErrorContext => {
    return {
      component,
      action,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: user?.id,
      role: user?.role,
      department: user?.department
    }
  }, [component, user])

  // Log error activity
  const logErrorActivity = useCallback(async (error: Error, context: ErrorContext) => {
    if (!enableActivityLogging || !user?.id) return

    try {
      await activityLogAPI.log({
        action: 'error_occurred',
        module: context.component,
        entity_type: 'error',
        details: {
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
          context,
          user_id: user.id,
          role: user.role,
          department: user.department
        }
      })
    } catch (logError) {
      console.warn('Failed to log error activity:', logError)
    }
  }, [enableActivityLogging, user])

  // Report error to external service (placeholder)
  const reportError = useCallback(async (error: Error, context: ErrorContext) => {
    if (!enableErrorReporting) return

    try {
      // This would typically send to an error reporting service like Sentry
      console.error('Error reported:', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        context
      })
    } catch (reportError) {
      console.warn('Failed to report error:', reportError)
    }
  }, [enableErrorReporting])

  // Handle error
  const handleError = useCallback(async (
    error: Error, 
    action: string = 'unknown',
    customOptions: Partial<UseEnhancedErrorHandlingOptions> = {}
  ) => {
    const context = createErrorContext(action)
    const errorId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const errorReport: ErrorReport = {
      id: errorId,
      error,
      context,
      retryCount: 0,
      resolved: false
    }

    // Add error to state
    setErrors(prev => [...prev, errorReport])

    // Log error activity
    await logErrorActivity(error, context)

    // Report error
    await reportError(error, context)

    // Show toast if enabled
    if (customOptions.showToastOnError ?? showToastOnError) {
      const severity = error instanceof APIError ? getErrorSeverity(error) : 'high'
      const title = getErrorTitle(error)
      const description = getErrorDescription(error)

      toast({
        title,
        description,
        variant: severity === 'critical' ? 'destructive' : 'default',
      })
    }

    return errorReport
  }, [
    createErrorContext,
    logErrorActivity,
    reportError,
    showToastOnError,
    toast
  ])

  // Retry operation
  const retry = useCallback(async (
    operation: () => Promise<any>,
    action: string = 'retry',
    customMaxRetries?: number
  ) => {
    const maxRetriesToUse = customMaxRetries ?? maxRetries
    
    if (retryCount >= maxRetriesToUse) {
      throw new Error(`Maximum retry attempts (${maxRetriesToUse}) exceeded`)
    }

    setIsRetrying(true)
    
    try {
      // Wait before retrying
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }

      const result = await operation()
      
      // Success - reset retry count
      setRetryCount(0)
      setIsRetrying(false)
      
      return result
    } catch (error) {
      setRetryCount(prev => prev + 1)
      setIsRetrying(false)
      
      // Handle the error
      await handleError(error as Error, action)
      
      throw error
    }
  }, [retryCount, maxRetries, retryDelay, handleError])

  // Clear error
  const clearError = useCallback((errorId: string) => {
    setErrors(prev => prev.map(error => 
      error.id === errorId 
        ? { ...error, resolved: true, resolvedAt: Date.now() }
        : error
    ))
  }, [])

  // Clear all errors
  const clearAllErrors = useCallback(() => {
    setErrors(prev => prev.map(error => ({
      ...error,
      resolved: true,
      resolvedAt: Date.now()
    })))
    setRetryCount(0)
  }, [])

  // Get active errors
  const getActiveErrors = useCallback(() => {
    return errors.filter(error => !error.resolved)
  }, [errors])

  // Get error by ID
  const getError = useCallback((errorId: string) => {
    return errors.find(error => error.id === errorId)
  }, [errors])

  // Check if there are any active errors
  const hasActiveErrors = errors.some(error => !error.resolved)

  // Auto-clear resolved errors after 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setErrors(prev => prev.filter(error => {
        if (error.resolved && error.resolvedAt) {
          return Date.now() - error.resolvedAt < 5 * 60 * 1000 // 5 minutes
        }
        return true
      }))
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  return {
    // State
    errors,
    isRetrying,
    retryCount,
    hasActiveErrors,
    
    // Actions
    handleError,
    retry,
    clearError,
    clearAllErrors,
    
    // Utilities
    getActiveErrors,
    getError,
    
    // Computed values
    canRetry: retryCount < maxRetries,
    remainingRetries: maxRetries - retryCount,
  }
}

// Utility functions for error handling
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

// Hook for handling API errors specifically
export function useAPIErrorHandling(options: UseEnhancedErrorHandlingOptions = {}) {
  const errorHandling = useEnhancedErrorHandling(options)

  const handleAPIError = useCallback(async (
    error: APIError,
    action: string = 'api_call',
    retryOperation?: () => Promise<any>
  ) => {
    const errorReport = await errorHandling.handleError(error, action)

    // If it's a retryable error and we have a retry operation, offer retry
    if (retryOperation && isRetryableError(error)) {
      try {
        const result = await errorHandling.retry(retryOperation, action)
        return result
      } catch (retryError) {
        // Retry failed, error is already handled
        throw retryError
      }
    }

    return errorReport
  }, [errorHandling])

  return {
    ...errorHandling,
    handleAPIError,
  }
}

// Check if an error is retryable
function isRetryableError(error: APIError): boolean {
  // Network errors and server errors are generally retryable
  if (error.status === 0) return true // Network error
  if (error.status >= 500) return true // Server errors
  if (error.status === 429) return true // Rate limiting
  
  // Client errors are generally not retryable
  return false
}
