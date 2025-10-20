import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { dashboardAPI, activityLogAPI, userPreferencesAPI } from '@/lib/api-client'
import { APIError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

interface DashboardMetrics {
  totalPatients: number
  totalConsultations: number
  totalPrescriptions: number
  totalRevenue: number
  todaysConsultations: number
  todaysRevenue: number
  pendingPrescriptions: number
  lowStockItems: number
  outOfStockItems: number
  criticalExpiries: number
  monthlyRevenue: number
  revenueChange: number
  patientGrowth: number
  consultationGrowth: number
  prescriptionGrowth: number
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical'
  database: boolean
  redis: boolean
  storage: boolean
  uptime: string
  responseTime: number
}

interface UserPreferences {
  layout_config: any
  custom_metrics: any[]
  favorite_modules: string[]
  refresh_interval: number
  auto_refresh: boolean
  theme: string
  language: string
  timezone: string
}

interface UseDashboardDataOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  enableActivityLogging?: boolean
}

export function useDashboardData(options: UseDashboardDataOptions = {}) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    autoRefresh = true,
    refreshInterval = 300, // 5 minutes default
    enableActivityLogging = true
  } = options

  // Load user preferences
  const loadUserPreferences = useCallback(async () => {
    if (!user?.id) return

    try {
      const preferences = await userPreferencesAPI.get(user.id)
      setUserPreferences(preferences)
      return preferences
    } catch (error) {
      console.warn('Failed to load user preferences:', error)
      return null
    }
  }, [user?.id])

  // Load dashboard metrics
  const loadMetrics = useCallback(async () => {
    if (!user) return

    try {
      let metricsData: any = null
      
      // Try user-specific metrics first
      if (user.id) {
        try {
          metricsData = await dashboardAPI.getUserMetrics(user.id)
        } catch (error) {
          console.warn('Failed to load user metrics, falling back to role metrics:', error)
        }
      }
      
      // Fall back to role-based metrics
      if (!metricsData && user.role) {
        try {
          metricsData = await dashboardAPI.getRoleMetrics(user.role)
        } catch (error) {
          console.warn('Failed to load role metrics, falling back to department metrics:', error)
        }
      }
      
      // Fall back to department-based metrics
      if (!metricsData && user.department) {
        try {
          metricsData = await dashboardAPI.getDepartmentMetrics(user.department)
        } catch (error) {
          console.warn('Failed to load department metrics:', error)
        }
      }

      if (metricsData) {
        setMetrics(metricsData)
        setError(null)
      }
    } catch (error) {
      console.error('Failed to load metrics:', error)
      setError(error instanceof APIError ? error.message : 'Failed to load dashboard metrics')
    }
  }, [user])

  // Load system health
  const loadSystemHealth = useCallback(async () => {
    try {
      const health = await dashboardAPI.getSystemHealth()
      setSystemHealth(health)
    } catch (error) {
      console.warn('Failed to load system health:', error)
    }
  }, [])

  // Log activity
  const logActivity = useCallback(async (action: string, details: any = {}) => {
    if (!enableActivityLogging || !user?.id) return

    try {
      await activityLogAPI.log({
        action,
        module: 'dashboard',
        entity_type: 'dashboard',
        details: {
          user_id: user.id,
          role: user.role,
          department: user.department,
          ...details
        }
      })
    } catch (error) {
      console.warn('Failed to log activity:', error)
    }
  }, [enableActivityLogging, user])

  // Load all dashboard data
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // Load user preferences first
      const preferences = await loadUserPreferences()
      
      // Load metrics and system health in parallel
      await Promise.all([
        loadMetrics(),
        loadSystemHealth()
      ])

      // Log dashboard view activity
      await logActivity('view_dashboard', {
        metrics_loaded: !!metrics,
        system_health_loaded: !!systemHealth,
        preferences_loaded: !!preferences
      })

    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      setError(error instanceof APIError ? error.message : 'Failed to load dashboard data')
      
      toast({
        title: "Error",
        description: error instanceof APIError 
          ? error.message 
          : "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadUserPreferences, loadMetrics, loadSystemHealth, logActivity, metrics, systemHealth, toast])

  // Refresh function
  const refresh = useCallback(() => {
    loadDashboardData(true)
  }, [loadDashboardData])

  // Update user preferences
  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    if (!user?.id) return

    try {
      const updatedPreferences = await userPreferencesAPI.update(user.id, updates)
      setUserPreferences(updatedPreferences)
      
      await logActivity('update_preferences', { updates })
      
      toast({
        title: "Success",
        description: "Dashboard preferences updated successfully",
      })
      
      return updatedPreferences
    } catch (error) {
      console.error('Failed to update preferences:', error)
      toast({
        title: "Error",
        description: error instanceof APIError 
          ? error.message 
          : "Failed to update preferences. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }, [user?.id, logActivity, toast])

  // Reset preferences to default
  const resetPreferences = useCallback(async () => {
    if (!user?.id) return

    try {
      const defaultPreferences = await userPreferencesAPI.reset(user.id)
      setUserPreferences(defaultPreferences)
      
      await logActivity('reset_preferences', {})
      
      toast({
        title: "Success",
        description: "Dashboard preferences reset to default",
      })
      
      return defaultPreferences
    } catch (error) {
      console.error('Failed to reset preferences:', error)
      toast({
        title: "Error",
        description: error instanceof APIError 
          ? error.message 
          : "Failed to reset preferences. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }, [user?.id, logActivity, toast])

  // Load data on mount
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Auto-refresh based on preferences or options
  useEffect(() => {
    const interval = userPreferences?.refresh_interval || refreshInterval
    const shouldAutoRefresh = userPreferences?.auto_refresh ?? autoRefresh

    if (!shouldAutoRefresh) return

    const refreshTimer = setInterval(() => {
      loadDashboardData(true)
    }, interval * 1000)

    return () => clearInterval(refreshTimer)
  }, [userPreferences, refreshInterval, autoRefresh, loadDashboardData])

  return {
    // Data
    metrics,
    systemHealth,
    userPreferences,
    
    // State
    loading,
    refreshing,
    error,
    
    // Actions
    refresh,
    updatePreferences,
    resetPreferences,
    logActivity,
    
    // Computed values
    isHealthy: systemHealth?.status === 'healthy',
    hasAlerts: metrics && (metrics.criticalExpiries > 0 || metrics.outOfStockItems > 0),
    canRefresh: !loading && !refreshing,
  }
}
