'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, TrendingDown, Users, Calendar, DollarSign,
  Pill, Package, AlertTriangle, Clock, FileText, Activity,
  RefreshCw, Settings, BarChart3, PieChart, Wifi, WifiOff,
  Bell, BellOff, Zap, AlertCircle
} from 'lucide-react'
import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard'
import { useToast } from '@/hooks/use-toast'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  color: string
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
  realtime?: boolean
  lastUpdated?: number
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  color,
  trend,
  loading,
  realtime = false,
  lastUpdated
}: MetricCardProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  // Trigger animation when value changes
  useEffect(() => {
    if (lastUpdated) {
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [lastUpdated])

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <Icon className={`h-4 w-4 ${color}`} />
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse mt-2"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`transition-all duration-300 ${isAnimating ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{title}</h3>
          {realtime && (
            <Badge variant="outline" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Live
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Icon className={`h-4 w-4 ${color}`} />
          {realtime && (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold transition-all duration-300 ${isAnimating ? 'scale-105' : ''}`}>
          {value}
        </div>
        {change !== undefined && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
            <span className={trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : ''}>
              {change > 0 ? '+' : ''}{change}%
            </span>
            {' '}from last month
          </p>
        )}
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mt-1">
            Updated {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface RealtimeDashboardOverviewProps {
  role?: string
  userId?: string
  department?: string
  enableRealtime?: boolean
}

export function RealtimeDashboardOverview({
  role,
  userId,
  department,
  enableRealtime = true
}: RealtimeDashboardOverviewProps) {
  const { toast } = useToast()
  const [showSystemAlerts, setShowSystemAlerts] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const {
    metrics,
    systemHealth,
    userPreferences,
    systemAlerts,
    loading,
    refreshing,
    error,
    wsConnected,
    lastRealtimeUpdate,
    refresh,
    clearSystemAlerts,
    connectionStatus,
    realtimeEnabled,
    updateCount,
    timeSinceLastUpdate
  } = useRealtimeDashboard({
    enableRealtime,
    enableWebSocket: enableRealtime,
    autoRefresh: !enableRealtime, // Fallback to polling if WebSocket disabled
    enableActivityLogging: true
  })

  const currentRole = role || 'receptionist'

  // Handle notification permission
  useEffect(() => {
    if (notificationsEnabled && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }
  }, [notificationsEnabled])

  // Show notification for system alerts
  useEffect(() => {
    if (notificationsEnabled && systemAlerts.length > 0) {
      const latestAlert = systemAlerts[0]
      if (latestAlert && latestAlert.severity === 'critical') {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('System Alert', {
            body: latestAlert.message,
            icon: '/favicon.ico'
          })
        }
      }
    }
  }, [systemAlerts, notificationsEnabled])

  const handleRefresh = () => {
    refresh()
    toast({
      title: "Refreshing",
      description: "Dashboard data is being refreshed...",
    })
  }

  const handleToggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled)
    toast({
      title: "Notifications",
      description: `Notifications ${!notificationsEnabled ? 'enabled' : 'disabled'}`,
    })
  }

  const handleToggleSystemAlerts = () => {
    setShowSystemAlerts(!showSystemAlerts)
  }

  const formatTimeSinceUpdate = (timestamp: number | null) => {
    if (!timestamp) return 'Never'

    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  // Show loading state
  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Real-time Dashboard</h2>
            <p className="text-muted-foreground">
              Loading real-time clinic metrics...
            </p>
          </div>
        </div>

        {/* Loading skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCard
              key={i}
              title="Loading..."
              value=""
              icon={BarChart3}
              color="text-gray-400"
              loading={true}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Real-time Dashboard</h2>
          <p className="text-muted-foreground">
            Live clinic metrics for {currentRole}
            {department && ` - ${department}`}
            {realtimeEnabled && wsConnected && (
              <span className="ml-2 inline-flex items-center gap-1 text-green-600">
                <Wifi className="h-4 w-4" />
                Live
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection Status */}
          <Badge variant={wsConnected ? "default" : "secondary"}>
            {wsConnected ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </>
            )}
          </Badge>

          {/* Update Count */}
          {realtimeEnabled && (
            <Badge variant="outline">
              {updateCount} updates
            </Badge>
          )}

          {/* Notifications Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleNotifications}
          >
            {notificationsEnabled ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* Settings Button */}
          <Button
            variant="outline"
            size="sm"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Connection Status Alert */}
      {!wsConnected && realtimeEnabled && (
        <Alert className="border-yellow-500 bg-yellow-50">
          <WifiOff className="h-5 w-5 text-yellow-600" />
          <AlertDescription>
            <span className="font-semibold text-yellow-900">
              Real-time updates unavailable
            </span>
            {' '}- Using fallback polling mode. Some data may not be current.
          </AlertDescription>
        </Alert>
      )}

      {/* System Health Alert */}
      {systemHealth && systemHealth.status !== 'healthy' && (
        <Alert className={systemHealth.status === 'critical' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}>
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription>
            <span className="font-semibold">
              System Status: {systemHealth.status.toUpperCase()}
            </span>
            {' '}- {systemHealth.status === 'critical' ? 'Immediate attention required' : 'Some services may be affected'}
          </AlertDescription>
        </Alert>
      )}

      {/* System Alerts */}
      {showSystemAlerts && systemAlerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">System Alerts</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearSystemAlerts}
              >
                Clear All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleSystemAlerts}
              >
                Hide
              </Button>
            </div>
          </div>
          {systemAlerts.slice(0, 3).map((alert, index) => (
            <Alert key={index} className={alert.severity === 'critical' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}>
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription>
                <span className="font-semibold">
                  {alert.title || 'System Alert'}
                </span>
                {' '}- {alert.message}
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(alert.timestamp).toLocaleString()}
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Critical Alerts */}
      {metrics && (metrics.criticalExpiries > 0 || metrics.outOfStockItems > 0) && (
        <div className="space-y-3">
          {metrics.criticalExpiries > 0 && (
            <Alert className="border-red-500 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription>
                <span className="font-semibold text-red-900">
                  {metrics.criticalExpiries} medicine batch(es) expired or expiring within 30 days
                </span>
                {' '}- Review expiry alerts immediately
              </AlertDescription>
            </Alert>
          )}

          {metrics.outOfStockItems > 0 && (
            <Alert className="border-orange-500 bg-orange-50">
              <Package className="h-5 w-5 text-orange-600" />
              <AlertDescription>
                <span className="font-semibold text-orange-900">
                  {metrics.outOfStockItems} medicine(s) out of stock
                </span>
                {' '}- Reorder immediately to avoid shortages
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Key Metrics - Row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Today's Revenue"
          value={metrics ? `KSh ${metrics.todaysRevenue?.toLocaleString() || 0}` : 'KSh 0'}
          change={(metrics?.revenueChange as number | undefined) ?? undefined}
          icon={DollarSign}
          color="text-green-600"
          trend={metrics?.revenueChange && metrics.revenueChange > 0 ? 'up' : metrics?.revenueChange && metrics.revenueChange < 0 ? 'down' : 'neutral'}
          loading={loading}
          realtime={realtimeEnabled}
          lastUpdated={lastRealtimeUpdate ?? undefined}
        />
        <MetricCard
          title="Today's Consultations"
          value={metrics?.todaysConsultations || 0}
          icon={FileText}
          color="text-blue-600"
          loading={loading}
          realtime={realtimeEnabled}
          lastUpdated={lastRealtimeUpdate ?? undefined}
        />
        <MetricCard
          title="Total Patients"
          value={metrics?.totalPatients || 0}
          change={(metrics?.patientGrowth as number | undefined) ?? undefined}
          icon={Users}
          color="text-purple-600"
          trend={metrics?.patientGrowth && metrics.patientGrowth > 0 ? 'up' : metrics?.patientGrowth && metrics.patientGrowth < 0 ? 'down' : 'neutral'}
          loading={loading}
          realtime={realtimeEnabled}
          lastUpdated={lastRealtimeUpdate ?? undefined}
        />
        <MetricCard
          title="Pending Prescriptions"
          value={metrics?.pendingPrescriptions || 0}
          icon={Pill}
          color="text-orange-600"
          loading={loading}
          realtime={realtimeEnabled}
          lastUpdated={lastRealtimeUpdate ?? undefined}
        />
      </div>

      {/* Key Metrics - Row 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Monthly Revenue"
          value={metrics ? `KSh ${metrics.monthlyRevenue?.toLocaleString() || 0}` : 'KSh 0'}
          change={(metrics?.revenueChange as number | undefined) ?? undefined}
          icon={TrendingUp}
          color="text-green-600"
          trend={metrics?.revenueChange && metrics.revenueChange > 0 ? 'up' : metrics?.revenueChange && metrics.revenueChange < 0 ? 'down' : 'neutral'}
          loading={loading}
          realtime={realtimeEnabled}
          lastUpdated={lastRealtimeUpdate ?? undefined}
        />
        <MetricCard
          title="Total Consultations"
          value={metrics?.totalConsultations || 0}
          change={(metrics?.consultationGrowth as number | undefined) ?? undefined}
          icon={Calendar}
          color="text-blue-600"
          trend={metrics?.consultationGrowth && metrics.consultationGrowth > 0 ? 'up' : metrics?.consultationGrowth && metrics.consultationGrowth < 0 ? 'down' : 'neutral'}
          loading={loading}
          realtime={realtimeEnabled}
          lastUpdated={lastRealtimeUpdate ?? undefined}
        />
        <MetricCard
          title="Total Prescriptions"
          value={metrics?.totalPrescriptions || 0}
          change={(metrics?.prescriptionGrowth as number | undefined) ?? undefined}
          icon={Pill}
          color="text-purple-600"
          trend={metrics?.prescriptionGrowth && metrics.prescriptionGrowth > 0 ? 'up' : metrics?.prescriptionGrowth && metrics.prescriptionGrowth < 0 ? 'down' : 'neutral'}
          loading={loading}
          realtime={realtimeEnabled}
          lastUpdated={lastRealtimeUpdate ?? undefined}
        />
        <MetricCard
          title="Low Stock Items"
          value={metrics?.lowStockItems || 0}
          icon={Package}
          color="text-orange-600"
          loading={loading}
          realtime={realtimeEnabled}
          lastUpdated={lastRealtimeUpdate ?? undefined}
        />
      </div>

      {/* Real-time Status */}
      {realtimeEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Connection</span>
                <Badge variant={wsConnected ? "default" : "destructive"}>
                  {wsConnected ? "Connected" : "Disconnected"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Updates Received</span>
                <Badge variant="outline">
                  {updateCount}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Update</span>
                <Badge variant="outline">
                  {formatTimeSinceUpdate(lastRealtimeUpdate)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Reconnect Attempts</span>
                <Badge variant="outline">
                  {connectionStatus.reconnectAttempts}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
