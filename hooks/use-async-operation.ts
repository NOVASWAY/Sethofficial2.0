import { useState, useCallback } from 'react'
import { useErrorHandler } from './use-error-handler'

export interface AsyncOperationState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export interface UseAsyncOperationReturn<T> {
  state: AsyncOperationState<T>
  execute: (operation: () => Promise<T>, context?: string) => Promise<T | null>
  reset: () => void
  setData: (data: T | null) => void
}

export function useAsyncOperation<T = any>(): UseAsyncOperationReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const { isLoading, error, executeWithErrorHandling, clearError } = useErrorHandler()

  const execute = useCallback(async (
    operation: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    const result = await executeWithErrorHandling(operation, context)
    if (result !== null) {
      setData(result)
    }
    return result
  }, [executeWithErrorHandling])

  const reset = useCallback(() => {
    setData(null)
    clearError()
  }, [clearError])

  return {
    state: {
      data,
      loading: isLoading,
      error: error?.message || null,
    },
    execute,
    reset,
    setData,
  }
}

// Specialized hook for data fetching operations
export function useDataFetching<T = any>() {
  const asyncOp = useAsyncOperation<T>()
  
  const fetchData = useCallback(async (
    fetchFn: () => Promise<T>,
    context?: string
  ) => {
    return await asyncOp.execute(fetchFn, context)
  }, [asyncOp])

  return {
    ...asyncOp.state,
    fetchData,
    reset: asyncOp.reset,
  }
}

// Hook for form submissions
export function useFormSubmission<T = any>() {
  const asyncOp = useAsyncOperation<T>()
  
  const submit = useCallback(async (
    submitFn: () => Promise<T>,
    context?: string
  ) => {
    return await asyncOp.execute(submitFn, context)
  }, [asyncOp])

  return {
    ...asyncOp.state,
    submit,
    reset: asyncOp.reset,
  }
}
