// Error handling utilities and types

export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: string
}

export interface ErrorState {
  hasError: boolean
  error: AppError | null
  retryCount: number
}

// Error types
export const ERROR_TYPES = {
  NETWORK: 'NETWORK_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  SERVER: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
} as const

// Create standardized error
export function createError(
  code: string,
  message: string,
  details?: any
): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString()
  }
}

// Network error handler
export function handleNetworkError(error: any): AppError {
  if (error.code === 'NETWORK_ERROR' || !navigator.onLine) {
    return createError(
      ERROR_TYPES.NETWORK,
      'Network connection error. Please check your internet connection.',
      { originalError: error }
    )
  }

  if (error.response) {
    // Server responded with error status
    const status = error.response.status
    const message = error.response.data?.message || error.message

    switch (status) {
      case 400:
        return createError(ERROR_TYPES.VALIDATION, message, error.response.data)
      case 401:
        return createError(ERROR_TYPES.AUTHENTICATION, 'Authentication required', error.response.data)
      case 403:
        return createError(ERROR_TYPES.AUTHORIZATION, 'Access denied', error.response.data)
      case 404:
        return createError(ERROR_TYPES.NOT_FOUND, 'Resource not found', error.response.data)
      case 500:
        return createError(ERROR_TYPES.SERVER, 'Server error. Please try again later.', error.response.data)
      default:
        return createError(ERROR_TYPES.SERVER, message, error.response.data)
    }
  }

  if (error.request) {
    // Request was made but no response received
    return createError(
      ERROR_TYPES.NETWORK,
      'Unable to connect to server. Please try again.',
      { originalError: error }
    )
  }

  // Something else happened
  return createError(
    ERROR_TYPES.UNKNOWN,
    error.message || 'An unexpected error occurred',
    { originalError: error }
  )
}

// Validation error handler
export function handleValidationError(errors: any[]): AppError {
  return createError(
    ERROR_TYPES.VALIDATION,
    'Please correct the following errors:',
    { validationErrors: errors }
  )
}

// Authentication error handler
export function handleAuthError(error: any): AppError {
  return createError(
    ERROR_TYPES.AUTHENTICATION,
    error.message || 'Authentication failed',
    { originalError: error }
  )
}

// Retry mechanism
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (attempt === maxRetries) {
        throw error
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }

  throw lastError
}

// Error logging
export function logError(error: AppError, context?: string): void {
  console.error(`[${context || 'APP'}] Error:`, {
    code: error.code,
    message: error.message,
    details: error.details,
    timestamp: error.timestamp,
    stack: error.details?.originalError?.stack
  })

  // In production, you would send this to an error tracking service
  // like Sentry, LogRocket, or similar
}

// Error boundary helper
export function getErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message
  }
  
  if (typeof error === 'string') {
    return error
  }
  
  if (error?.message) {
    return error.message
  }
  
  return 'An unexpected error occurred'
}

// Async error wrapper
export function asyncErrorHandler<T extends any[], R>(
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      const appError = handleNetworkError(error)
      logError(appError, fn.name)
      throw appError
    }
  }
}

// Form error helper
export function getFieldError(errors: any[], fieldName: string): string | null {
  const fieldError = errors.find(error => error.field === fieldName)
  return fieldError ? fieldError.message : null
}
