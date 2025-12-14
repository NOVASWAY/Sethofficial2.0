/**
 * Optimized Dashboard Hook
 * Provides efficient data fetching with caching, memoization, and parallel requests
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { dashboardCache, getCacheKey, withCache } from '@/lib/dashboard-cache'
import { reportsAPI, dashboardAPI } from '@/lib/api-client'

interface DashboardMetrics {
  today?: { appointments?: number; consultations?: number; revenue?: number }
  alerts?: { pending_prescriptions?: number; low_stock_medicines?: number; pending_invoices?: number }
  overview?: { total_patients?: number; monthly_revenue?: number }
}

interface UseOptimizedDashboardOptions {
  role?: string
  enableCache?: boolean
  cacheTTL?: number
  refreshInterval?: number
}

export function useOptimizedDashboard(options: UseOptimizedDashboardOptions = {}) {
  const { user } = useAuth()
  const {
    role: providedRole,
    enableCache = true,
    cacheTTL = 5 * 60 * 1000, // 5 minutes default
    refreshInterval
  } = options

  const role = providedRole || user?.role || 'receptionist'
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generate cache key
  const cacheKey = useMemo(() => getCacheKey('dashboard', { role, userId: user?.id }), [role, user?.id])

  // Fetch dashboard data with caching
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const data = enableCache
        ? await withCache(cacheKey, () => reportsAPI.getDashboard(), cacheTTL)
        : await reportsAPI.getDashboard()

      setMetrics(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data'
      setError(errorMessage)
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [cacheKey, enableCache, cacheTTL])

  // Initial load
  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Auto-refresh if interval provided
  useEffect(() => {
    if (!refreshInterval) return

    const interval = setInterval(() => {
      // Invalidate cache before refresh
      if (enableCache) {
        dashboardCache.invalidate(cacheKey)
      }
      fetchDashboardData()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [refreshInterval, enableCache, cacheKey, fetchDashboardData])

  // Manual refresh function
  const refresh = useCallback(() => {
    if (enableCache) {
      dashboardCache.invalidate(cacheKey)
    }
    fetchDashboardData()
  }, [enableCache, cacheKey, fetchDashboardData])

  // Invalidate cache when data changes
  const invalidateCache = useCallback(() => {
    if (enableCache) {
      dashboardCache.invalidatePattern(`dashboard:.*:.*${role}.*`)
    }
  }, [enableCache, role])

  return {
    metrics,
    loading,
    error,
    refresh,
    invalidateCache
  }
}

/**
 * Hook for fetching financial data with caching
 */
export function useOptimizedFinancialData(dateFrom: string, dateTo: string, cacheTTL = 10 * 60 * 1000) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cacheKey = useMemo(() => getCacheKey('financial', { date_from: dateFrom, date_to: dateTo }), [dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await withCache(
        cacheKey,
        () => reportsAPI.getFinancial({ date_from: dateFrom, date_to: dateTo }),
        cacheTTL
      )
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load financial data')
    } finally {
      setLoading(false)
    }
  }, [cacheKey, dateFrom, dateTo, cacheTTL])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refresh = useCallback(() => {
    dashboardCache.invalidate(cacheKey)
    fetchData()
  }, [cacheKey, fetchData])

  return { data, loading, error, refresh }
}

