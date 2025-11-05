'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  TrendingUp, TrendingDown, Users, Calendar, DollarSign, 
  Pill, Package, AlertTriangle, Clock, FileText, Activity
} from 'lucide-react'
import { useInventory } from '@/contexts/inventory-context'
import { usePatient } from '@/contexts/patient-context'
import { useAuth } from '@/contexts/auth-context'
import { getAllExpiryAlerts } from '@/lib/expiry-utils'
import { useDataIsolation } from '@/hooks/use-data-isolation'
import { reportsAPI } from '@/lib/api-client'
import { dashboardCache, getCacheKey, withCache } from '@/lib/dashboard-cache'
import { useMemo, useCallback } from 'react'
import { Skeleton } from "@/components/ui/loading"

interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ElementType
  color: string
  trend?: 'up' | 'down' | 'neutral'
}

function MetricCard({ title, value, change, icon: Icon, color, trend }: MetricCardProps) {
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

interface DashboardOverviewProps {
  role?: string
}

export function DashboardOverview({ role }: DashboardOverviewProps = {}) {
  const { medicines, stockMovements, getLowStockMedicines, getOutOfStockMedicines } = useInventory()
  const { patientsData } = usePatient()
  const { user } = useAuth()
  
  // Convert patients data to array for data isolation
  const patientsArray = Array.from(patientsData.values())
  
  // Use data isolation for user-specific data
  const { filteredData: filteredPatients, dataCount: patientCount } = useDataIsolation(
    patientsArray,
    {
      userField: 'created_by',
      departmentField: 'department',
      assignedField: 'assigned_to',
      createdByField: 'created_by',
      permissions: getUserDataPermissions(role || user?.role || 'receptionist')
    }
  )
  
  // Get user data permissions function
  function getUserDataPermissions(role: string) {
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

  // Calculate metrics (memoized for performance)
  const totalPatients = useMemo(() => patientCount.filtered, [patientCount.filtered])
  
  const lowStockItems = useMemo(() => getLowStockMedicines().length, [medicines])
  const outOfStockItems = useMemo(() => getOutOfStockMedicines().length, [medicines])
  
  const expiryAlerts = useMemo(() => getAllExpiryAlerts(medicines), [medicines])
  const criticalExpiries = useMemo(
    () => expiryAlerts.filter(a => a.severity === 'expired' || a.severity === 'critical').length,
    [expiryAlerts]
  )
  
  // Dashboard metrics from API
  const [dashboardMetrics, setDashboardMetrics] = useState<{
    today?: { appointments?: number; consultations?: number; revenue?: number }
    alerts?: { pending_prescriptions?: number; low_stock_medicines?: number; pending_invoices?: number }
    overview?: { total_patients?: number; monthly_revenue?: number }
  } | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  // Memoized cache key for dashboard metrics
  const dashboardCacheKey = useMemo(() => getCacheKey('metrics', { role }), [role])

  useEffect(() => {
    const fetchDashboardMetrics = async () => {
      try {
        setMetricsLoading(true)
        // Use cache wrapper to reduce redundant API calls
        const data = await withCache(
          dashboardCacheKey,
          () => reportsAPI.getDashboard(),
          5 * 60 * 1000 // Cache for 5 minutes
        )
        setDashboardMetrics(data)
      } catch (error) {
        console.error("Error fetching dashboard metrics:", error)
        // Fallback to context-based calculations
        setDashboardMetrics(null)
      } finally {
        setMetricsLoading(false)
      }
    }
    fetchDashboardMetrics()
  }, [dashboardCacheKey])

  // Memoize today's date to avoid recalculation
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])
  
  // Memoize expensive calculations
  const todaysMovements = useMemo(
    () => stockMovements.filter(m => m.timestamp.startsWith(today)),
    [stockMovements, today]
  )
  
  const todaysConsultations = useMemo(
    () => filteredPatients
      .flatMap(p => p.consultations)
      .filter(c => c.date === today),
    [filteredPatients, today]
  )
  
  // Calculate inventory value (memoized)
  const totalInventoryValue = useMemo(
    () => medicines.reduce((sum, m) => sum + (m.currentStock * m.unitPrice), 0),
    [medicines]
  )
  
  // Calculate revenue change from historical data (with caching)
  const [revenueChange, setRevenueChange] = useState<number>(0)
  
  useEffect(() => {
    const calculateRevenueChange = async () => {
      try {
        const now = new Date()
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

        const currentMonthKey = getCacheKey('financial', {
          date_from: currentMonthStart.toISOString().split('T')[0],
          date_to: currentMonthEnd.toISOString().split('T')[0]
        })
        const previousMonthKey = getCacheKey('financial', {
          date_from: previousMonthStart.toISOString().split('T')[0],
          date_to: previousMonthEnd.toISOString().split('T')[0]
        })

        // Fetch both in parallel with caching
        const [currentMonthData, previousMonthData] = await Promise.all([
          withCache(currentMonthKey, () => reportsAPI.getFinancial({
            date_from: currentMonthStart.toISOString().split('T')[0],
            date_to: currentMonthEnd.toISOString().split('T')[0]
          }), 10 * 60 * 1000), // Cache for 10 minutes
          withCache(previousMonthKey, () => reportsAPI.getFinancial({
            date_from: previousMonthStart.toISOString().split('T')[0],
            date_to: previousMonthEnd.toISOString().split('T')[0]
          }), 10 * 60 * 1000) // Cache for 10 minutes
        ])

        const currentRevenue = currentMonthData?.revenue?.total_paid || 0
        const previousRevenue = previousMonthData?.revenue?.total_paid || 0

        if (previousRevenue > 0) {
          const change = ((currentRevenue - previousRevenue) / previousRevenue) * 100
          setRevenueChange(change)
        } else if (currentRevenue > 0) {
          setRevenueChange(100) // 100% increase if previous was 0
        } else {
          setRevenueChange(0)
        }
      } catch (error) {
        console.error("Error calculating revenue change:", error)
        setRevenueChange(0)
      }
    }
    calculateRevenueChange()
  }, [])

  // Use API data if available, otherwise fallback to context
  const todaysRevenue = dashboardMetrics?.today?.revenue || 0
  const monthlyRevenue = dashboardMetrics?.overview?.monthly_revenue || 0
  
  // Memoize expensive calculations
  const pendingPrescriptions = useMemo(() => {
    if (dashboardMetrics?.alerts?.pending_prescriptions !== undefined) {
      return dashboardMetrics.alerts.pending_prescriptions
    }
    return filteredPatients
      .flatMap(p => p.consultations)
      .flatMap(c => c.prescriptions)
      .filter(p => p.status === 'pending').length
  }, [dashboardMetrics?.alerts?.pending_prescriptions, filteredPatients])
  
  const todaysConsultationsCount = useMemo(
    () => dashboardMetrics?.today?.consultations || todaysConsultations.length,
    [dashboardMetrics?.today?.consultations, todaysConsultations.length]
  )
  
  const todaysAppointmentsCount = dashboardMetrics?.today?.appointments || 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground">
          Real-time clinic metrics and alerts
        </p>
      </div>

      {/* Critical Alerts */}
      {(criticalExpiries > 0 || outOfStockItems > 0) && (
        <div className="space-y-3">
          {criticalExpiries > 0 && (
            <Alert className="border-red-500 bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <AlertDescription>
                <span className="font-semibold text-red-900">
                  {criticalExpiries} medicine batch(es) expired or expiring within 30 days
                </span>
                {' '}- Review expiry alerts immediately
              </AlertDescription>
            </Alert>
          )}
          
          {outOfStockItems > 0 && (
            <Alert className="border-orange-500 bg-orange-50">
              <Package className="h-5 w-5 text-orange-600" />
              <AlertDescription>
                <span className="font-semibold text-orange-900">
                  {outOfStockItems} medicine(s) out of stock
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
          value={metricsLoading ? (
            <Skeleton className="h-6 w-24" />
          ) : `KSh ${todaysRevenue.toLocaleString()}`}
          change={revenueChange}
          icon={DollarSign}
          color="text-green-600"
          trend="up"
        />
        <MetricCard
          title="Today's Consultations"
          value={metricsLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : todaysConsultationsCount}
          icon={FileText}
          color="text-blue-600"
        />
        <MetricCard
          title="Pending Prescriptions"
          value={pendingPrescriptions}
          icon={Pill}
          color="text-purple-600"
        />
        <MetricCard
          title="Total Patients"
          value={totalPatients}
          change={8.2}
          icon={Users}
          color="text-indigo-600"
          trend="up"
        />
      </div>

      {/* Key Metrics - Row 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Inventory Value"
          value={`KSh ${totalInventoryValue.toLocaleString()}`}
          icon={Package}
          color="text-teal-600"
        />
        <MetricCard
          title="Low Stock Items"
          value={lowStockItems}
          icon={AlertTriangle}
          color="text-yellow-600"
        />
        <MetricCard
          title="Out of Stock"
          value={outOfStockItems}
          icon={Package}
          color="text-red-600"
        />
        <MetricCard
          title="Stock Movements Today"
          value={todaysMovements.length}
          icon={Activity}
          color="text-cyan-600"
        />
      </div>

      {/* Detailed Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Stock Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaysMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock movements today</p>
            ) : (
              <div className="space-y-2">
                {todaysMovements.slice(0, 5).map((movement) => (
                  <div key={movement.id} className="flex justify-between items-start text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{movement.medicineName}</p>
                      <p className="text-xs text-muted-foreground">
                        {movement.movementType} - {movement.quantity} units
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {new Date(movement.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Badge>
                  </div>
                ))}
                {todaysMovements.length > 5 && (
                  <p className="text-xs text-muted-foreground pt-2">
                    +{todaysMovements.length - 5} more movements today
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiry Alerts Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Expiry Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Expired</span>
                <Badge variant="destructive">
                  {expiryAlerts.filter(a => a.severity === 'expired').length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Critical (≤30 days)</span>
                <Badge className="bg-orange-500">
                  {expiryAlerts.filter(a => a.severity === 'critical').length}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Warning (≤90 days)</span>
                <Badge className="bg-yellow-500">
                  {expiryAlerts.filter(a => a.severity === 'warning').length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monthly Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Revenue</span>
                <span className="font-semibold">KSh {monthlyRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Consultations</span>
                <span className="font-semibold">324</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">New Patients</span>
                <span className="font-semibold">45</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Items */}
      <Card>
        <CardHeader>
          <CardTitle>Action Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {outOfStockItems > 0 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-red-50">
                <Package className="h-5 w-5 text-red-600" />
                <div className="flex-1">
                  <p className="font-semibold text-red-900">{outOfStockItems} items out of stock</p>
                  <p className="text-sm text-muted-foreground">Reorder immediately</p>
                </div>
              </div>
            )}
            
            {lowStockItems > 0 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-yellow-50">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div className="flex-1">
                  <p className="font-semibold text-yellow-900">{lowStockItems} items low on stock</p>
                  <p className="text-sm text-muted-foreground">Plan reorder soon</p>
                </div>
              </div>
            )}
            
            {pendingPrescriptions > 0 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-purple-50">
                <Pill className="h-5 w-5 text-purple-600" />
                <div className="flex-1">
                  <p className="font-semibold text-purple-900">{pendingPrescriptions} pending prescriptions</p>
                  <p className="text-sm text-muted-foreground">Ready for dispensing</p>
                </div>
              </div>
            )}
            
            {criticalExpiries > 0 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-orange-50">
                <Clock className="h-5 w-5 text-orange-600" />
                <div className="flex-1">
                  <p className="font-semibold text-orange-900">{criticalExpiries} critical expiry alerts</p>
                  <p className="text-sm text-muted-foreground">Review expiry dates</p>
                </div>
              </div>
            )}
            
            {outOfStockItems === 0 && lowStockItems === 0 && pendingPrescriptions === 0 && criticalExpiries === 0 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-green-50">
                <Activity className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-semibold text-green-900">All systems operational</p>
                  <p className="text-sm text-muted-foreground">No critical issues at this time</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
