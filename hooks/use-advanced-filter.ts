import { useState, useMemo, useCallback } from 'react'
import { useDebounce } from './use-debounce'

export interface FilterOption {
  label: string
  value: string
  count?: number
}

export interface FilterConfig {
  field: string
  label: string
  type: 'select' | 'multiselect' | 'date' | 'dateRange' | 'number' | 'numberRange' | 'text'
  options?: FilterOption[]
  placeholder?: string
}

export interface AdvancedFilterState {
  [key: string]: string | string[] | { from?: string; to?: string } | undefined
}

interface UseAdvancedFilterOptions<T> {
  data: T[]
  filters: FilterConfig[]
  searchFields?: string[]
  debounceMs?: number
}

/**
 * Hook for advanced filtering with multiple criteria
 * Supports debounced search, multiple filter types, and memoized results
 */
export function useAdvancedFilter<T extends Record<string, any>>({
  data,
  filters,
  searchFields = [],
  debounceMs = 300,
}: UseAdvancedFilterOptions<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterState, setFilterState] = useState<AdvancedFilterState>({})
  const [showFilters, setShowFilters] = useState(false)

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, debounceMs)

  // Update filter state
  const updateFilter = useCallback((field: string, value: any) => {
    setFilterState(prev => ({
      ...prev,
      [field]: value,
    }))
  }, [])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilterState({})
    setSearchTerm('')
  }, [])

  // Clear specific filter
  const clearFilter = useCallback((field: string) => {
    setFilterState(prev => {
      const newState = { ...prev }
      delete newState[field]
      return newState
    })
  }, [])

  // Get active filter count
  const activeFilterCount = useMemo(() => {
    return Object.keys(filterState).filter(key => {
      const value = filterState[key]
      if (value === undefined || value === null || value === '') return false
      if (Array.isArray(value) && value.length === 0) return false
      if (typeof value === 'object' && 'from' in value && !value.from && !value.to) return false
      return true
    }).length + (debouncedSearchTerm ? 1 : 0)
  }, [filterState, debouncedSearchTerm])

  // Apply filters to data
  const filteredData = useMemo(() => {
    let result = [...data]

    // Apply search term
    if (debouncedSearchTerm && searchFields.length > 0) {
      const searchLower = debouncedSearchTerm.toLowerCase()
      result = result.filter(item =>
        searchFields.some(field => {
          const value = item[field]
          if (value === null || value === undefined) return false
          return String(value).toLowerCase().includes(searchLower)
        })
      )
    }

    // Apply filters
    filters.forEach(filter => {
      const filterValue = filterState[filter.field]
      if (!filterValue) return

      switch (filter.type) {
        case 'select':
          if (typeof filterValue === 'string' && filterValue !== 'all') {
            result = result.filter(item => String(item[filter.field]) === filterValue)
          }
          break

        case 'multiselect':
          if (Array.isArray(filterValue) && filterValue.length > 0) {
            result = result.filter(item =>
              filterValue.includes(String(item[filter.field]))
            )
          }
          break

        case 'date':
          if (typeof filterValue === 'string') {
            const filterDate = new Date(filterValue).toDateString()
            result = result.filter(item => {
              const itemDate = new Date(item[filter.field]).toDateString()
              return itemDate === filterDate
            })
          }
          break

        case 'dateRange':
          if (typeof filterValue === 'object' && filterValue !== null) {
            const { from, to } = filterValue as { from?: string; to?: string }
            result = result.filter(item => {
              const itemDate = new Date(item[filter.field])
              if (from && itemDate < new Date(from)) return false
              if (to && itemDate > new Date(to)) return false
              return true
            })
          }
          break

        case 'number':
          if (typeof filterValue === 'string') {
            const numValue = parseFloat(filterValue)
            if (!isNaN(numValue)) {
              result = result.filter(item => {
                const itemValue = parseFloat(item[filter.field])
                return !isNaN(itemValue) && itemValue === numValue
              })
            }
          }
          break

        case 'numberRange':
          if (typeof filterValue === 'object' && filterValue !== null) {
            const { from, to } = filterValue as { from?: number; to?: number }
            result = result.filter(item => {
              const itemValue = parseFloat(item[filter.field])
              if (isNaN(itemValue)) return false
              if (from !== undefined && itemValue < from) return false
              if (to !== undefined && itemValue > to) return false
              return true
            })
          }
          break

        case 'text':
          if (typeof filterValue === 'string') {
            const filterLower = filterValue.toLowerCase()
            result = result.filter(item => {
              const itemValue = item[filter.field]
              return String(itemValue).toLowerCase().includes(filterLower)
            })
          }
          break
      }
    })

    return result
  }, [data, filters, filterState, debouncedSearchTerm, searchFields])

  // Get filter options with counts (for select/multiselect)
  const getFilterOptionsWithCounts = useCallback((field: string): FilterOption[] => {
    const filter = filters.find(f => f.field === field)
    if (!filter || !filter.options) return []

    // Calculate counts for each option
    return filter.options.map(option => {
      const count = data.filter(item => String(item[field]) === option.value).length
      return { ...option, count }
    })
  }, [data, filters])

  return {
    searchTerm,
    setSearchTerm,
    filterState,
    updateFilter,
    clearFilters,
    clearFilter,
    filteredData,
    activeFilterCount,
    showFilters,
    setShowFilters,
    getFilterOptionsWithCounts,
  }
}

