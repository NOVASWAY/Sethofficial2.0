import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { AppError, handleNetworkError, logError, ERROR_TYPES } from '@/lib/error-handler'

export interface UseErrorHandlerReturn {
  error: AppError | null
  isLoading: boolean
  setError: (error: AppError | null) => void
  setLoading: (loading: boolean) => void
  handleError: (error: any, context?: string) => void
  clearError: () => void
  executeWithErrorHandling: <T>(
    operation: () => Promise<T>,
    context?: string
  ) => Promise<T | null>
}

export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setError] = useState<AppError | null>(null)
  const [isLoading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleError = useCallback((error: any, context?: string) => {
    const appError = handleNetworkError(error)
    setError(appError)
    logError(appError, context)

    // Show user-friendly toast notification
    toast({
      title: getErrorTitle(appError.code),
      description: appError.message,
      variant: 'destructive',
    })
  }, [toast])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    try {
      setLoading(true)
      clearError()
      return await operation()
    } catch (error) {
      handleError(error, context)
      return null
    } finally {
      setLoading(false)
    }
  }, [handleError, clearError])

  return {
    error,
    isLoading,
    setError,
    setLoading,
    handleError,
    clearError,
    executeWithErrorHandling,
  }
}

function getErrorTitle(errorCode: string): string {
  switch (errorCode) {
    case ERROR_TYPES.NETWORK:
      return 'Connection Error'
    case ERROR_TYPES.VALIDATION:
      return 'Validation Error'
    case ERROR_TYPES.AUTHENTICATION:
      return 'Authentication Error'
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
