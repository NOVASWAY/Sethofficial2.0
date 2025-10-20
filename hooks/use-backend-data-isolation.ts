import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { dataIsolationAPI, activityLogAPI } from '@/lib/api-client'
import { APIError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

interface FilteredData<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

interface DataIsolationOptions {
  page?: number
  limit?: number
  search?: string
  patient_id?: string
  payment_status?: string
  action?: string
  module?: string
  entity_type?: string
}

interface UseBackendDataIsolationOptions {
  entityType: 'patients' | 'consultations' | 'prescriptions' | 'invoices'
  enableActivityLogging?: boolean
  autoLoad?: boolean
}

export function useBackendDataIsolation<T = any>(
  options: UseBackendDataIsolationOptions
) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    per_page: 20,
    total_pages: 0
  })

  const {
    entityType,
    enableActivityLogging = true,
    autoLoad = true
  } = options

  // Load filtered data based on user permissions
  const loadData = useCallback(async (params: DataIsolationOptions = {}) => {
    if (!user) return

    try {
      setLoading(true)
      setError(null)

      let response: FilteredData<T>

      // Call the appropriate API based on entity type
      switch (entityType) {
        case 'patients':
          response = await dataIsolationAPI.getFilteredPatients(params)
          break
        case 'consultations':
          response = await dataIsolationAPI.getFilteredConsultations(params)
          break
        case 'prescriptions':
          response = await dataIsolationAPI.getFilteredPrescriptions(params)
          break
        case 'invoices':
          response = await dataIsolationAPI.getFilteredInvoices(params)
          break
        default:
          throw new Error(`Unsupported entity type: ${entityType}`)
      }

      setData(response.data)
      setPagination({
        total: response.total,
        page: response.page,
        per_page: response.per_page,
        total_pages: response.total_pages
      })

      // Log data access activity
      if (enableActivityLogging) {
        try {
          await activityLogAPI.log({
            action: 'view_data',
            module: entityType,
            entity_type: entityType,
            details: {
              user_id: user.id,
              role: user.role,
              department: user.department,
              filters: params,
              result_count: response.data.length,
              total_count: response.total
            }
          })
        } catch (error) {
          console.warn('Failed to log data access activity:', error)
        }
      }

    } catch (error) {
      console.error(`Failed to load ${entityType}:`, error)
      setError(error instanceof APIError ? error.message : `Failed to load ${entityType}`)
      
      toast({
        title: "Error",
        description: error instanceof APIError 
          ? error.message 
          : `Failed to load ${entityType}. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, entityType, enableActivityLogging, toast])

  // Validate data access permissions
  const validateAccess = useCallback(async (entityId: string, action: string) => {
    if (!user) return false

    try {
      const result = await dataIsolationAPI.validateAccess({
        entity_type: entityType,
        entity_id: entityId,
        action
      })

      return result.has_access
    } catch (error) {
      console.error('Failed to validate access:', error)
      return false
    }
  }, [user, entityType])

  // Search data
  const search = useCallback((query: string, additionalParams: DataIsolationOptions = {}) => {
    loadData({
      ...additionalParams,
      search: query,
      page: 1 // Reset to first page when searching
    })
  }, [loadData])

  // Load page
  const loadPage = useCallback((page: number, additionalParams: DataIsolationOptions = {}) => {
    loadData({
      ...additionalParams,
      page
    })
  }, [loadData])

  // Refresh data
  const refresh = useCallback((additionalParams: DataIsolationOptions = {}) => {
    loadData({
      ...additionalParams,
      page: pagination.page // Keep current page
    })
  }, [loadData, pagination.page])

  // Load data on mount if autoLoad is enabled
  useEffect(() => {
    if (autoLoad && user) {
      loadData()
    }
  }, [autoLoad, user, loadData])

  return {
    // Data
    data,
    pagination,
    
    // State
    loading,
    error,
    
    // Actions
    loadData,
    search,
    loadPage,
    refresh,
    validateAccess,
    
    // Computed values
    hasData: data.length > 0,
    hasNextPage: pagination.page < pagination.total_pages,
    hasPreviousPage: pagination.page > 1,
    isEmpty: !loading && data.length === 0,
    totalCount: pagination.total,
  }
}

// Specialized hooks for different entity types
export function useFilteredPatients(options: Omit<UseBackendDataIsolationOptions, 'entityType'> = {}) {
  return useBackendDataIsolation({
    ...options,
    entityType: 'patients'
  })
}

export function useFilteredConsultations(options: Omit<UseBackendDataIsolationOptions, 'entityType'> = {}) {
  return useBackendDataIsolation({
    ...options,
    entityType: 'consultations'
  })
}

export function useFilteredPrescriptions(options: Omit<UseBackendDataIsolationOptions, 'entityType'> = {}) {
  return useBackendDataIsolation({
    ...options,
    entityType: 'prescriptions'
  })
}

export function useFilteredInvoices(options: Omit<UseBackendDataIsolationOptions, 'entityType'> = {}) {
  return useBackendDataIsolation({
    ...options,
    entityType: 'invoices'
  })
}
