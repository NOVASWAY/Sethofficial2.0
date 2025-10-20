'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, TrendingDown, Users, Calendar, DollarSign, 
  Pill, Package, AlertTriangle, Clock, FileText, Activity,
  RefreshCw, Settings, BarChart3, PieChart
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { dashboardAPI, activityLogAPI, userPreferencesAPI } from '@/lib/api-client'
import { APIError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  color: string
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
}

function MetricCard({ title, value, change, icon: Icon, color, trend, loading }: MetricCardProps) {
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
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
      </CardContent>
    </Card>
  )
}

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

interface EnhancedDashboardOverviewProps {
  role?: string
  userId?: string
  department?: string
}

export function EnhancedDashboardOverview({ 
  role, 
  userId, 
  department 
}: EnhancedDashboardOverviewProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userPreferences, setUserPreferences] = useState<any>(null)

  const currentRole = role || user?.role || 'receptionist'
  const currentUserId = userId || user?.id
  const currentDepartment = department || user?.department

  // Load dashboard data
  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      // Load user preferences first
      if (currentUserId) {
        try {
          const preferences = await userPreferencesAPI.get(currentUserId)
          setUserPreferences(preferences)
        } catch (error) {
          console.warn('Failed to load user preferences:', error)
        }
      }

      // Load metrics based on user role and permissions
      let metricsData: any = null
      
      if (currentUserId) {
        // Try user-specific metrics first
        try {
          metricsData = await dashboardAPI.getUserMetrics(currentUserId)
        } catch (error) {
          console.warn('Failed to load user metrics, falling back to role metrics:', error)
        }
      }
      
      if (!metricsData && currentRole) {
        // Fall back to role-based metrics
        try {
          metricsData = await dashboardAPI.getRoleMetrics(currentRole)
        } catch (error) {
          console.warn('Failed to load role metrics, falling back to department metrics:', error)
        }
      }
      
      if (!metricsData && currentDepartment) {
        // Fall back to department-based metrics
        try {
          metricsData = await dashboardAPI.getDepartmentMetrics(currentDepartment)
        } catch (error) {
          console.warn('Failed to load department metrics:', error)
        }
      }

      if (metricsData) {
        setMetrics(metricsData)
      }

      // Load system health
      try {
        const health = await dashboardAPI.getSystemHealth()
        setSystemHealth(health)
      } catch (error) {
        console.warn('Failed to load system health:', error)
      }

      // Log dashboard view activity
      if (currentUserId) {
        try {
          await activityLogAPI.log({
            action: 'view_dashboard',
            module: 'dashboard',
            entity_type: 'dashboard',
            details: {
              role: currentRole,
              department: currentDepartment,
              metrics_loaded: !!metricsData,
              system_health_loaded: !!systemHealth
            }
          })
        } catch (error) {
          console.warn('Failed to log dashboard view activity:', error)
        }
      }

    } catch (error) {
      console.error('Failed to load dashboard data:', error)
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
  }

  // Load data on component mount
  useEffect(() => {
    loadDashboardData()
  }, [currentRole, currentUserId, currentDepartment])

  // Auto-refresh based on user preferences
  useEffect(() => {
    if (!userPreferences?.auto_refresh || !userPreferences?.refresh_interval) return

    const interval = setInterval(() => {
      loadDashboardData(true)
    }, userPreferences.refresh_interval * 1000)

    return () => clearInterval(interval)
  }, [userPreferences])

  const handleRefresh = () => {
    loadDashboardData(true)
  }

  const handleSettings = () => {
    // Navigate to dashboard settings
    // This would typically open a modal or navigate to settings page
    toast({
      title: "Settings",
      description: "Dashboard settings would open here",
    })
  }

  // Show loading state
  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
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
          <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-muted-foreground">
            Real-time clinic metrics and alerts for {currentRole}
            {currentDepartment && ` - ${currentDepartment}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSettings}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

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
          value={metrics ? `KSh ${metrics.todaysRevenue.toLocaleString()}` : 'KSh 0'}
          change={metrics?.revenueChange}
          icon={DollarSign}
          color="text-green-600"
          trend={metrics?.revenueChange && metrics.revenueChange > 0 ? 'up' : metrics?.revenueChange && metrics.revenueChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Today's Consultations"
          value={metrics?.todaysConsultations || 0}
          icon={FileText}
          color="text-blue-600"
          loading={loading}
        />
        <MetricCard
          title="Total Patients"
          value={metrics?.totalPatients || 0}
          change={metrics?.patientGrowth}
          icon={Users}
          color="text-purple-600"
          trend={metrics?.patientGrowth && metrics.patientGrowth > 0 ? 'up' : metrics?.patientGrowth && metrics.patientGrowth < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Pending Prescriptions"
          value={metrics?.pendingPrescriptions || 0}
          icon={Pill}
          color="text-orange-600"
          loading={loading}
        />
      </div>

      {/* Key Metrics - Row 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Monthly Revenue"
          value={metrics ? `KSh ${metrics.monthlyRevenue.toLocaleString()}` : 'KSh 0'}
          change={metrics?.revenueChange}
          icon={TrendingUp}
          color="text-green-600"
          trend={metrics?.revenueChange && metrics.revenueChange > 0 ? 'up' : metrics?.revenueChange && metrics.revenueChange < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Total Consultations"
          value={metrics?.totalConsultations || 0}
          change={metrics?.consultationGrowth}
          icon={Calendar}
          color="text-blue-600"
          trend={metrics?.consultationGrowth && metrics.consultationGrowth > 0 ? 'up' : metrics?.consultationGrowth && metrics.consultationGrowth < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Total Prescriptions"
          value={metrics?.totalPrescriptions || 0}
          change={metrics?.prescriptionGrowth}
          icon={Pill}
          color="text-purple-600"
          trend={metrics?.prescriptionGrowth && metrics.prescriptionGrowth > 0 ? 'up' : metrics?.prescriptionGrowth && metrics.prescriptionGrowth < 0 ? 'down' : 'neutral'}
          loading={loading}
        />
        <MetricCard
          title="Low Stock Items"
          value={metrics?.lowStockItems || 0}
          icon={Package}
          color="text-orange-600"
          loading={loading}
        />
      </div>

      {/* System Health Status */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Database</span>
                <Badge variant={systemHealth.database ? "default" : "destructive"}>
                  {systemHealth.database ? "Healthy" : "Error"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cache</span>
                <Badge variant={systemHealth.redis ? "default" : "destructive"}>
                  {systemHealth.redis ? "Healthy" : "Error"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Storage</span>
                <Badge variant={systemHealth.storage ? "default" : "destructive"}>
                  {systemHealth.storage ? "Healthy" : "Error"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Response Time</span>
                <Badge variant={systemHealth.responseTime < 100 ? "default" : systemHealth.responseTime < 500 ? "secondary" : "destructive"}>
                  {systemHealth.responseTime}ms
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Preferences Info */}
      {userPreferences && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Dashboard Preferences
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Auto Refresh</span>
                <Badge variant={userPreferences.auto_refresh ? "default" : "secondary"}>
                  {userPreferences.auto_refresh ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Refresh Interval</span>
                <Badge variant="outline">
                  {userPreferences.refresh_interval}s
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Theme</span>
                <Badge variant="outline">
                  {userPreferences.theme || 'system'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Language</span>
                <Badge variant="outline">
                  {userPreferences.language || 'en'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
