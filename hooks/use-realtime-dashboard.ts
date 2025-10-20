import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useDashboardData } from './use-dashboard-data'
import { useWebSocket, WebSocketEventHandlers } from '@/lib/websocket-service'
import { useToast } from '@/hooks/use-toast'

interface RealtimeDashboardOptions {
  enableRealtime?: boolean
  enableWebSocket?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  enableActivityLogging?: boolean
}

export function useRealtimeDashboard(options: RealtimeDashboardOptions = {}) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const {
    enableRealtime = true,
    enableWebSocket = true,
    autoRefresh = true,
    refreshInterval = 300,
    enableActivityLogging = true
  } = options

  // Use the existing dashboard data hook
  const dashboardData = useDashboardData({
    autoRefresh: !enableWebSocket, // Disable auto-refresh if WebSocket is enabled
    refreshInterval,
    enableActivityLogging
  })

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false)
  const [lastRealtimeUpdate, setLastRealtimeUpdate] = useState<number | null>(null)
  const [realtimeMetrics, setRealtimeMetrics] = useState<any>(null)
  const [systemAlerts, setSystemAlerts] = useState<any[]>([])
  
  // Refs for tracking updates
  const updateCountRef = useRef(0)
  const lastUpdateTimeRef = useRef<number>(0)

  // WebSocket event handlers
  const wsHandlers: WebSocketEventHandlers = {
    onConnect: () => {
      console.log('WebSocket connected for dashboard')
      setWsConnected(true)
      
      if (enableActivityLogging) {
        // Log WebSocket connection
        console.log('Dashboard WebSocket connected')
      }
    },

    onDisconnect: () => {
      console.log('WebSocket disconnected for dashboard')
      setWsConnected(false)
    },

    onError: (error) => {
      console.error('WebSocket error in dashboard:', error)
      toast({
        title: "Connection Error",
        description: "Lost connection to real-time updates. Some data may not be current.",
        variant: "destructive",
      })
    },

    onDashboardUpdate: (data) => {
      console.log('Received dashboard update:', data)
      setRealtimeMetrics(data)
      setLastRealtimeUpdate(Date.now())
      updateCountRef.current++
      lastUpdateTimeRef.current = Date.now()

      // Show toast for significant updates
      if (data.alert && data.alert.severity === 'high') {
        toast({
          title: "Dashboard Alert",
          description: data.alert.message,
          variant: "destructive",
        })
      }
    },

    onSystemAlert: (data) => {
      console.log('Received system alert:', data)
      setSystemAlerts(prev => [data, ...prev.slice(0, 9)]) // Keep last 10 alerts

      // Show toast for system alerts
      toast({
        title: "System Alert",
        description: data.message,
        variant: data.severity === 'critical' ? 'destructive' : 'default',
      })
    },

    onPatientUpdate: (data) => {
      console.log('Received patient update:', data)
      // Trigger dashboard refresh if patient data affects metrics
      if (data.type === 'create' || data.type === 'update' || data.type === 'delete') {
        dashboardData.refresh()
      }
    },

    onConsultationUpdate: (data) => {
      console.log('Received consultation update:', data)
      // Trigger dashboard refresh if consultation data affects metrics
      if (data.type === 'create' || data.type === 'update' || data.type === 'delete') {
        dashboardData.refresh()
      }
    },

    onPrescriptionUpdate: (data) => {
      console.log('Received prescription update:', data)
      // Trigger dashboard refresh if prescription data affects metrics
      if (data.type === 'create' || data.type === 'update' || data.type === 'delete') {
        dashboardData.refresh()
      }
    },

    onInvoiceUpdate: (data) => {
      console.log('Received invoice update:', data)
      // Trigger dashboard refresh if invoice data affects metrics
      if (data.type === 'create' || data.type === 'update' || data.type === 'delete') {
        dashboardData.refresh()
      }
    },

    onActivityLog: (data) => {
      console.log('Received activity log:', data)
      // Could update activity feed or notifications
    }
  }

  // Initialize WebSocket connection
  const ws = useWebSocket(wsHandlers)

  // Subscribe to relevant events when connected
  useEffect(() => {
    if (wsConnected && enableWebSocket) {
      // Subscribe to dashboard and system events
      ws.subscribe([
        'dashboard_update',
        'system_alert',
        'patient_update',
        'consultation_update',
        'prescription_update',
        'invoice_update',
        'activity_log'
      ])
    }
  }, [wsConnected, enableWebSocket, ws])

  // Request dashboard refresh when WebSocket connects
  useEffect(() => {
    if (wsConnected && enableWebSocket) {
      ws.requestDashboardRefresh()
    }
  }, [wsConnected, enableWebSocket, ws])

  // Handle realtime data updates
  const handleRealtimeUpdate = useCallback((newData: any) => {
    setRealtimeMetrics(newData)
    setLastRealtimeUpdate(Date.now())
  }, [])

  // Request dashboard refresh
  const requestRefresh = useCallback(() => {
    if (enableWebSocket && wsConnected) {
      ws.requestDashboardRefresh()
    } else {
      dashboardData.refresh()
    }
  }, [enableWebSocket, wsConnected, ws, dashboardData])

  // Clear system alerts
  const clearSystemAlerts = useCallback(() => {
    setSystemAlerts([])
  }, [])

  // Get combined metrics (API + realtime)
  const getCombinedMetrics = useCallback(() => {
    const baseMetrics = dashboardData.metrics
    const realtimeData = realtimeMetrics

    if (!baseMetrics && !realtimeData) {
      return null
    }

    if (!realtimeData) {
      return baseMetrics
    }

    if (!baseMetrics) {
      return realtimeData
    }

    // Merge base metrics with realtime updates
    return {
      ...baseMetrics,
      ...realtimeData,
      // Override specific fields with realtime data if available
      todaysRevenue: realtimeData.todaysRevenue ?? baseMetrics.todaysRevenue,
      todaysConsultations: realtimeData.todaysConsultations ?? baseMetrics.todaysConsultations,
      pendingPrescriptions: realtimeData.pendingPrescriptions ?? baseMetrics.pendingPrescriptions,
      lowStockItems: realtimeData.lowStockItems ?? baseMetrics.lowStockItems,
      outOfStockItems: realtimeData.outOfStockItems ?? baseMetrics.outOfStockItems,
      criticalExpiries: realtimeData.criticalExpiries ?? baseMetrics.criticalExpiries,
    }
  }, [dashboardData.metrics, realtimeMetrics])

  // Get connection status
  const getConnectionStatus = useCallback(() => {
    return {
      ...ws.getConnectionStatus(),
      realtimeEnabled: enableWebSocket && wsConnected,
      lastRealtimeUpdate,
      updateCount: updateCountRef.current,
      systemAlertsCount: systemAlerts.length
    }
  }, [ws, enableWebSocket, wsConnected, lastRealtimeUpdate, systemAlerts.length])

  // Auto-refresh fallback when WebSocket is not available
  useEffect(() => {
    if (!enableWebSocket && autoRefresh && !dashboardData.loading) {
      const interval = setInterval(() => {
        dashboardData.refresh()
      }, refreshInterval * 1000)

      return () => clearInterval(interval)
    }
  }, [enableWebSocket, autoRefresh, refreshInterval, dashboardData])

  return {
    // Data
    metrics: getCombinedMetrics(),
    systemHealth: dashboardData.systemHealth,
    userPreferences: dashboardData.userPreferences,
    systemAlerts,
    
    // State
    loading: dashboardData.loading,
    refreshing: dashboardData.refreshing,
    error: dashboardData.error,
    wsConnected,
    lastRealtimeUpdate,
    
    // Actions
    refresh: requestRefresh,
    updatePreferences: dashboardData.updatePreferences,
    resetPreferences: dashboardData.resetPreferences,
    clearSystemAlerts,
    
    // WebSocket actions
    subscribe: ws.subscribe,
    unsubscribe: ws.unsubscribe,
    requestDataUpdate: ws.requestDataUpdate,
    
    // Utilities
    connectionStatus: getConnectionStatus(),
    isHealthy: dashboardData.isHealthy,
    hasAlerts: dashboardData.hasAlerts || systemAlerts.length > 0,
    canRefresh: dashboardData.canRefresh,
    
    // Realtime specific
    realtimeEnabled: enableWebSocket,
    updateCount: updateCountRef.current,
    timeSinceLastUpdate: lastRealtimeUpdate ? Date.now() - lastRealtimeUpdate : null,
  }
}
