/**
 * Custom hook for user-specific data isolation and filtering
 * Ensures users only see data they have permission to access
 */

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'

export interface DataFilter {
  field: string
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between'
  value: any
  value2?: any // For 'between' operator
}

export interface UserDataPermissions {
  canViewAll: boolean
  canEditAll: boolean
  canDeleteAll: boolean
  canViewOwn: boolean
  canEditOwn: boolean
  canDeleteOwn: boolean
  canViewDepartment: boolean
  canEditDepartment: boolean
  canDeleteDepartment: boolean
  canViewAssigned: boolean
  canEditAssigned: boolean
  canDeleteAssigned: boolean
}

export interface DataIsolationConfig {
  userField?: string // Field that contains user ID
  departmentField?: string // Field that contains department
  assignedField?: string // Field that contains assigned user ID
  createdByField?: string // Field that contains creator ID
  permissions: UserDataPermissions
}

/**
 * Get user-specific data permissions based on role
 */
export function getUserDataPermissions(role: string): UserDataPermissions {
  switch (role) {
    case 'admin':
      return {
        canViewAll: true,
        canEditAll: true,
        canDeleteAll: true,
        canViewOwn: true,
        canEditOwn: true,
        canDeleteOwn: true,
        canViewDepartment: true,
        canEditDepartment: true,
        canDeleteDepartment: true,
        canViewAssigned: true,
        canEditAssigned: true,
        canDeleteAssigned: true
      }
    
    case 'clinician':
      return {
        canViewAll: false,
        canEditAll: false,
        canDeleteAll: false,
        canViewOwn: true,
        canEditOwn: true,
        canDeleteOwn: false,
        canViewDepartment: true,
        canEditDepartment: true,
        canDeleteDepartment: false,
        canViewAssigned: true,
        canEditAssigned: true,
        canDeleteAssigned: false
      }
    
    case 'nurse':
      return {
        canViewAll: false,
        canEditAll: false,
        canDeleteAll: false,
        canViewOwn: true,
        canEditOwn: true,
        canDeleteOwn: false,
        canViewDepartment: true,
        canEditDepartment: false,
        canDeleteDepartment: false,
        canViewAssigned: true,
        canEditAssigned: false,
        canDeleteAssigned: false
      }
    
    case 'pharmacist':
      return {
        canViewAll: false,
        canEditAll: false,
        canDeleteAll: false,
        canViewOwn: true,
        canEditOwn: true,
        canDeleteOwn: false,
        canViewDepartment: true,
        canEditDepartment: true,
        canDeleteDepartment: false,
        canViewAssigned: true,
        canEditAssigned: true,
        canDeleteAssigned: false
      }
    
    case 'lab_technician':
      return {
        canViewAll: false,
        canEditAll: false,
        canDeleteAll: false,
        canViewOwn: true,
        canEditOwn: true,
        canDeleteOwn: false,
        canViewDepartment: true,
        canEditDepartment: true,
        canDeleteDepartment: false,
        canViewAssigned: true,
        canEditAssigned: true,
        canDeleteAssigned: false
      }
    
    case 'receptionist':
      return {
        canViewAll: false,
        canEditAll: false,
        canDeleteAll: false,
        canViewOwn: true,
        canEditOwn: true,
        canDeleteOwn: false,
        canViewDepartment: true,
        canEditDepartment: false,
        canDeleteDepartment: false,
        canViewAssigned: true,
        canEditAssigned: false,
        canDeleteAssigned: false
      }
    
    default:
      return {
        canViewAll: false,
        canEditAll: false,
        canDeleteAll: false,
        canViewOwn: true,
        canEditOwn: false,
        canDeleteOwn: false,
        canViewDepartment: false,
        canEditDepartment: false,
        canDeleteDepartment: false,
        canViewAssigned: false,
        canEditAssigned: false,
        canDeleteAssigned: false
      }
  }
}

/**
 * Generate data filters based on user permissions and data isolation config
 */
export function generateDataFilters(
  user: any,
  config: DataIsolationConfig
): DataFilter[] {
  const filters: DataFilter[] = []
  const permissions = config.permissions

  // If user can view all, no filters needed
  if (permissions.canViewAll) {
    return filters
  }

  // Add filters based on permissions
  if (permissions.canViewOwn && config.userField) {
    filters.push({
      field: config.userField,
      operator: 'equals',
      value: user.id
    })
  }

  if (permissions.canViewDepartment && config.departmentField && user.department) {
    filters.push({
      field: config.departmentField,
      operator: 'equals',
      value: user.department
    })
  }

  if (permissions.canViewAssigned && config.assignedField) {
    filters.push({
      field: config.assignedField,
      operator: 'equals',
      value: user.id
    })
  }

  if (permissions.canViewOwn && config.createdByField) {
    filters.push({
      field: config.createdByField,
      operator: 'equals',
      value: user.id
    })
  }

  return filters
}

/**
 * Apply data filters to a dataset
 */
export function applyDataFilters<T>(data: T[], filters: DataFilter[]): T[] {
  if (filters.length === 0) {
    return data
  }

  return data.filter(item => {
    return filters.some(filter => {
      const fieldValue = getNestedValue(item, filter.field)
      
      switch (filter.operator) {
        case 'equals':
          return fieldValue === filter.value
        case 'contains':
          return fieldValue && fieldValue.toString().toLowerCase().includes(filter.value.toLowerCase())
        case 'startsWith':
          return fieldValue && fieldValue.toString().toLowerCase().startsWith(filter.value.toLowerCase())
        case 'endsWith':
          return fieldValue && fieldValue.toString().toLowerCase().endsWith(filter.value.toLowerCase())
        case 'greaterThan':
          return fieldValue > filter.value
        case 'lessThan':
          return fieldValue < filter.value
        case 'between':
          return fieldValue >= filter.value && fieldValue <= (filter.value2 || filter.value)
        default:
          return true
      }
    })
  })
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

/**
 * Custom hook for data isolation
 */
export function useDataIsolation<T>(
  data: T[],
  config: DataIsolationConfig,
  additionalFilters: DataFilter[] = []
) {
  const { user } = useAuth()
  const [filteredData, setFilteredData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate user-specific filters
  const userFilters = useMemo(() => {
    if (!user) return []
    return generateDataFilters(user, config)
  }, [user, config])

  // Combine all filters
  const allFilters = useMemo(() => {
    return [...userFilters, ...additionalFilters]
  }, [userFilters, additionalFilters])

  // Apply filters to data
  useEffect(() => {
    if (!data || data.length === 0) {
      setFilteredData([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const filtered = applyDataFilters(data, allFilters)
      setFilteredData(filtered)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to filter data')
      setFilteredData([])
    } finally {
      setIsLoading(false)
    }
  }, [data, allFilters])

  // Check if user has permission for specific action
  const hasPermission = useMemo(() => {
    if (!user) return false
    
    return {
      canView: config.permissions.canViewAll || config.permissions.canViewOwn || 
               config.permissions.canViewDepartment || config.permissions.canViewAssigned,
      canEdit: config.permissions.canEditAll || config.permissions.canEditOwn || 
               config.permissions.canEditDepartment || config.permissions.canEditAssigned,
      canDelete: config.permissions.canDeleteAll || config.permissions.canDeleteOwn || 
                 config.permissions.canDeleteDepartment || config.permissions.canDeleteAssigned
    }
  }, [user, config.permissions])

  // Get user-specific data count
  const dataCount = useMemo(() => {
    return {
      total: data.length,
      filtered: filteredData.length,
      userSpecific: filteredData.length
    }
  }, [data.length, filteredData.length])

  return {
    filteredData,
    isLoading,
    error,
    hasPermission,
    dataCount,
    filters: allFilters,
    clearError: () => setError(null)
  }
}

/**
 * Hook for patient data isolation
 */
export function usePatientDataIsolation(patients: any[]) {
  const config: DataIsolationConfig = {
    userField: 'created_by',
    departmentField: 'department',
    assignedField: 'assigned_to',
    createdByField: 'created_by',
    permissions: getUserDataPermissions('receptionist') // Default permissions
  }

  return useDataIsolation(patients, config)
}

/**
 * Hook for appointment data isolation
 */
export function useAppointmentDataIsolation(appointments: any[]) {
  const config: DataIsolationConfig = {
    userField: 'doctor_id',
    departmentField: 'department',
    assignedField: 'assigned_to',
    createdByField: 'created_by',
    permissions: getUserDataPermissions('nurse') // Default permissions
  }

  return useDataIsolation(appointments, config)
}

/**
 * Hook for consultation data isolation
 */
export function useConsultationDataIsolation(consultations: any[]) {
  const config: DataIsolationConfig = {
    userField: 'doctor_id',
    departmentField: 'department',
    assignedField: 'assigned_to',
    createdByField: 'created_by',
    permissions: getUserDataPermissions('clinician') // Default permissions
  }

  return useDataIsolation(consultations, config)
}

/**
 * Hook for prescription data isolation
 */
export function usePrescriptionDataIsolation(prescriptions: any[]) {
  const config: DataIsolationConfig = {
    userField: 'prescribed_by',
    departmentField: 'department',
    assignedField: 'assigned_to',
    createdByField: 'created_by',
    permissions: getUserDataPermissions('pharmacist') // Default permissions
  }

  return useDataIsolation(prescriptions, config)
}

/**
 * Hook for invoice data isolation
 */
export function useInvoiceDataIsolation(invoices: any[]) {
  const config: DataIsolationConfig = {
    userField: 'created_by',
    departmentField: 'department',
    assignedField: 'assigned_to',
    createdByField: 'created_by',
    permissions: getUserDataPermissions('receptionist') // Default permissions
  }

  return useDataIsolation(invoices, config)
}

/**
 * Hook for user activity data isolation
 */
export function useUserActivityDataIsolation(activities: any[]) {
  const config: DataIsolationConfig = {
    userField: 'user_id',
    departmentField: 'department',
    assignedField: 'assigned_to',
    createdByField: 'created_by',
    permissions: getUserDataPermissions('admin') // Default permissions
  }

  return useDataIsolation(activities, config)
}
