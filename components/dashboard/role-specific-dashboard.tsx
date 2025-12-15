'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, Calendar, DollarSign, Pill, Package, AlertTriangle, 
  Clock, FileText, Activity, TrendingUp, BarChart3, 
  User, UserCog, Stethoscope, Shield, Bell, Star,
  Plus, Search, Filter, Download, RefreshCw, Settings, Edit,
  FlaskConical, CheckCircle2, AlertCircle, FileCheck, Eye, UserPlus
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { usePatient } from '@/contexts/patient-context'
import { useInventory } from '@/contexts/inventory-context'
import { useDataIsolation } from '@/hooks/use-data-isolation'
import { useRouter } from 'next/navigation'
import { pharmacyAPI } from '@/lib/api-client'

interface RoleSpecificDashboardProps {
  role: string
}

export function RoleSpecificDashboard({ role }: RoleSpecificDashboardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const patientContext = usePatient()
  const inventoryContext = useInventory()
  
  // Safely extract context values with defaults
  const patientsData = patientContext?.patientsData || new Map()
  const medicines = inventoryContext?.medicines || []
  const stockMovements = inventoryContext?.stockMovements || []
  
  const [activeTab, setActiveTab] = useState('overview')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [stockAlerts, setStockAlerts] = useState<any[]>([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)

  // Load stock alerts for pharmacist
  useEffect(() => {
    if (role === 'pharmacist') {
      loadStockAlerts()
    }
  }, [role])

  const loadStockAlerts = async () => {
    setLoadingAlerts(true)
    try {
      const response = await pharmacyAPI.getStockAlerts({ days: 30 })
      setStockAlerts(response?.data || response || [])
    } catch (error) {
      console.error('Error loading stock alerts:', error)
      setStockAlerts([])
    } finally {
      setLoadingAlerts(false)
    }
  }

  // Get role-specific data permissions function
  const getUserDataPermissions = React.useCallback((role: string) => {
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
  }, [])

  // Safely convert patients data to array for data isolation
  const patientsArray = React.useMemo(() => {
    if (!patientsData || typeof patientsData.values !== 'function') {
      return []
    }
    try {
      return Array.from(patientsData.values())
    } catch (error) {
      console.error('Error converting patients data to array:', error)
      return []
    }
  }, [patientsData])

  // Get role-specific data permissions (memoized)
  const dataPermissions = React.useMemo(() => {
    return getUserDataPermissions(role)
  }, [role, getUserDataPermissions])

  // Use data isolation hooks
  const { filteredData: filteredPatients, dataCount: patientCount } = useDataIsolation(
    patientsArray,
    {
      userField: 'created_by',
      departmentField: 'department',
      assignedField: 'assigned_to',
      createdByField: 'created_by',
      permissions: dataPermissions
    }
  )

  // Get role-specific metrics
  const getRoleMetrics = () => {
    const baseMetrics = [
      { id: 'total_patients', label: 'Total Patients', icon: Users, value: patientCount?.filtered || 0, color: 'text-blue-600' },
      { id: 'today_consultations', label: 'Today\'s Consultations', icon: FileText, value: 12, color: 'text-green-600' },
      { id: 'pending_prescriptions', label: 'Pending Prescriptions', icon: Pill, value: 8, color: 'text-purple-600' },
      { id: 'low_stock_items', label: 'Low Stock Items', icon: AlertTriangle, value: 3, color: 'text-yellow-600' }
    ]

    switch (role) {
      case 'admin':
        return [
          ...baseMetrics,
          { id: 'total_revenue', label: 'Total Revenue', icon: DollarSign, value: 'KSh 1,250,000', color: 'text-green-600' },
          { id: 'active_users', label: 'Active Users', icon: User, value: 15, color: 'text-indigo-600' },
          { id: 'system_health', label: 'System Health', icon: Activity, value: '98%', color: 'text-green-600' },
          { id: 'audit_logs', label: 'Audit Logs', icon: Shield, value: 245, color: 'text-gray-600' }
        ]
      case 'receptionist':
        return [
          { id: 'new_patients_today', label: 'New Patients Today', icon: Users, value: 5, color: 'text-blue-600' },
          { id: 'appointments_today', label: 'Appointments Today', icon: Calendar, value: 18, color: 'text-green-600' },
          { id: 'pending_registrations', label: 'Pending Registrations', icon: FileText, value: 2, color: 'text-yellow-600' },
          { id: 'billing_pending', label: 'Pending Billing', icon: DollarSign, value: 7, color: 'text-orange-600' }
        ]
      case 'nurse':
        return [
          { id: 'patients_seen_today', label: 'Patients Seen Today', icon: Users, value: 12, color: 'text-blue-600' },
          { id: 'vitals_recorded', label: 'Vitals Recorded', icon: Activity, value: 15, color: 'text-green-600' },
          { id: 'pending_assessments', label: 'Pending Assessments', icon: Clock, value: 3, color: 'text-yellow-600' },
          { id: 'medications_administered', label: 'Medications Administered', icon: Pill, value: 8, color: 'text-purple-600' }
        ]
      case 'clinician':
        return [
          { id: 'consultations_today', label: 'Consultations Today', icon: Stethoscope, value: 8, color: 'text-blue-600' },
          { id: 'prescriptions_written', label: 'Prescriptions Written', icon: Pill, value: 12, color: 'text-green-600' },
          { id: 'diagnoses_made', label: 'Diagnoses Made', icon: FileText, value: 8, color: 'text-purple-600' },
          { id: 'follow_up_required', label: 'Follow-up Required', icon: Calendar, value: 5, color: 'text-orange-600' }
        ]
      case 'pharmacist':
        return [
          { id: 'prescriptions_dispensed', label: 'Prescriptions Dispensed', icon: Pill, value: 15, color: 'text-blue-600' },
          { id: 'stock_movements', label: 'Stock Movements', icon: Package, value: 8, color: 'text-green-600' },
          { id: 'expiry_alerts', label: 'Expiry Alerts', icon: AlertTriangle, value: 2, color: 'text-red-600' },
          { id: 'inventory_value', label: 'Inventory Value', icon: DollarSign, value: 'KSh 450,000', color: 'text-purple-600' }
        ]
      case 'lab_technician':
        return [
          { id: 'pending_orders', label: 'Pending Lab Orders', icon: FlaskConical, value: 8, color: 'text-blue-600' },
          { id: 'completed_today', label: 'Completed Today', icon: CheckCircle2, value: 15, color: 'text-green-600' },
          { id: 'urgent_orders', label: 'Urgent Orders', icon: AlertCircle, value: 2, color: 'text-orange-600' },
          { id: 'verified_today', label: 'Verified Today', icon: FileCheck, value: 12, color: 'text-purple-600' }
        ]
      default:
        return baseMetrics
    }
  }

  // Get role-specific quick actions
  const getQuickActions = () => {
    switch (role) {
      case 'admin':
        return [
          { label: 'Add User', icon: User, action: () => router.push(`/dashboard/${role}/users`), color: 'bg-blue-500' },
          { label: 'System Settings', icon: Settings, action: () => router.push(`/dashboard/${role}/settings`), color: 'bg-gray-500' },
          { label: 'Generate Report', icon: BarChart3, action: () => router.push(`/dashboard/${role}/reports`), color: 'bg-green-500' },
          { label: 'Audit Logs', icon: Shield, action: () => router.push(`/dashboard/${role}/audit-logs`), color: 'bg-purple-500' }
        ]
      case 'receptionist':
        return [
          { label: 'Register Patient', icon: UserPlus, action: () => router.push(`/dashboard/${role}/registration`), color: 'bg-blue-500' },
          { label: 'Schedule Appointment', icon: Calendar, action: () => router.push(`/dashboard/${role}/appointments`), color: 'bg-green-500' },
          { label: 'Process Billing', icon: DollarSign, action: () => router.push(`/dashboard/${role}/billing`), color: 'bg-purple-500' },
          { label: 'Search Patient', icon: Search, action: () => router.push(`/dashboard/${role}/patients`), color: 'bg-orange-500' }
        ]
      case 'nurse':
        return [
          { label: 'Record Vitals', icon: Activity, action: () => router.push(`/dashboard/${role}/consultation`), color: 'bg-blue-500' },
          { label: 'Patient Assessment', icon: FileText, action: () => router.push(`/dashboard/${role}/consultation`), color: 'bg-green-500' },
          { label: 'Patient Queue', icon: Users, action: () => router.push(`/dashboard/${role}/queue`), color: 'bg-purple-500' },
          { label: 'View Patients', icon: FileText, action: () => router.push(`/dashboard/${role}/patients`), color: 'bg-orange-500' }
        ]
      case 'clinician':
        return [
          { label: 'New Consultation', icon: Stethoscope, action: () => router.push(`/dashboard/${role}/consultation`), color: 'bg-blue-500' },
          { label: 'Patient Queue', icon: Users, action: () => router.push(`/dashboard/${role}/queue`), color: 'bg-green-500' },
          { label: 'Review Patient', icon: FileText, action: () => router.push(`/dashboard/${role}/patients`), color: 'bg-purple-500' },
          { label: 'Schedule Follow-up', icon: Calendar, action: () => router.push(`/dashboard/${role}/appointments`), color: 'bg-orange-500' }
        ]
      case 'pharmacist':
        return [
          { label: 'Prescription Queue', icon: Pill, action: () => router.push(`/dashboard/${role}/prescription-queue`), color: 'bg-blue-500' },
          { label: 'Stock Alerts', icon: AlertTriangle, action: () => router.push(`/dashboard/${role}/stock-alerts`), color: 'bg-red-500' },
          { label: 'Check Stock', icon: Package, action: () => router.push(`/dashboard/${role}/inventory`), color: 'bg-green-500' },
          { label: 'Update Inventory', icon: Edit, action: () => router.push(`/dashboard/${role}/pharmacy`), color: 'bg-purple-500' }
        ]
      case 'lab_technician':
        return [
          { label: 'Lab Queue', icon: FlaskConical, action: () => router.push(`/dashboard/${role}/lab/queue`), color: 'bg-blue-500' },
          { label: 'Enter Results', icon: FileText, action: () => router.push(`/dashboard/${role}/lab/results/enter`), color: 'bg-green-500' },
          { label: 'View Results', icon: Eye, action: () => router.push(`/dashboard/${role}/lab/results`), color: 'bg-purple-500' },
          { label: 'Lab Dashboard', icon: BarChart3, action: () => router.push(`/dashboard/${role}/lab`), color: 'bg-orange-500' }
        ]
      default:
        return []
    }
  }

  // Get role-specific recent activity
  const getRecentActivity = () => {
    const baseActivity = [
      { id: '1', action: 'Patient registered', time: '2 minutes ago', icon: Users, color: 'text-blue-600' },
      { id: '2', action: 'Consultation completed', time: '15 minutes ago', icon: Stethoscope, color: 'text-green-600' },
      { id: '3', action: 'Prescription dispensed', time: '30 minutes ago', icon: Pill, color: 'text-purple-600' }
    ]

    switch (role) {
      case 'admin':
        return [
          ...baseActivity,
          { id: '4', action: 'User created', time: '1 hour ago', icon: User, color: 'text-indigo-600' },
          { id: '5', action: 'System backup completed', time: '2 hours ago', icon: Shield, color: 'text-gray-600' }
        ]
      case 'receptionist':
        return [
          { id: '1', action: 'New patient registered', time: '5 minutes ago', icon: Users, color: 'text-blue-600' },
          { id: '2', action: 'Appointment scheduled', time: '10 minutes ago', icon: Calendar, color: 'text-green-600' },
          { id: '3', action: 'Payment processed', time: '20 minutes ago', icon: DollarSign, color: 'text-purple-600' }
        ]
      case 'nurse':
        return [
          { id: '1', action: 'Vitals recorded', time: '3 minutes ago', icon: Activity, color: 'text-blue-600' },
          { id: '2', action: 'Patient assessment completed', time: '12 minutes ago', icon: FileText, color: 'text-green-600' },
          { id: '3', action: 'Medication administered', time: '25 minutes ago', icon: Pill, color: 'text-purple-600' }
        ]
      case 'clinician':
        return [
          { id: '1', action: 'Consultation completed', time: '8 minutes ago', icon: Stethoscope, color: 'text-blue-600' },
          { id: '2', action: 'Prescription written', time: '18 minutes ago', icon: Pill, color: 'text-green-600' },
          { id: '3', action: 'Diagnosis recorded', time: '35 minutes ago', icon: FileText, color: 'text-purple-600' }
        ]
      case 'pharmacist':
        return [
          { id: '1', action: 'Medicine dispensed', time: '4 minutes ago', icon: Pill, color: 'text-blue-600' },
          { id: '2', action: 'Stock updated', time: '16 minutes ago', icon: Package, color: 'text-green-600' },
          { id: '3', action: 'Expiry alert checked', time: '28 minutes ago', icon: AlertTriangle, color: 'text-red-600' }
        ]
      case 'lab_technician':
        return [
          { id: '1', action: 'Lab result entered', time: '5 minutes ago', icon: FlaskConical, color: 'text-blue-600' },
          { id: '2', action: 'Result verified', time: '14 minutes ago', icon: CheckCircle2, color: 'text-green-600' },
          { id: '3', action: 'Urgent order processed', time: '22 minutes ago', icon: AlertCircle, color: 'text-orange-600' }
        ]
      default:
        return baseActivity
    }
  }

  // Memoize role-specific data to prevent unnecessary recalculations
  const roleMetrics = React.useMemo(() => getRoleMetrics(), [role, patientCount])
  const quickActions = React.useMemo(() => getQuickActions(), [role, router])
  const recentActivity = React.useMemo(() => getRecentActivity(), [role])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate refresh
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  // Show loading state if user is not available
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {role.charAt(0).toUpperCase() + role.slice(1)} Dashboard
          </h2>
          <p className="text-muted-foreground">
            Welcome back, {user.name} • {user.department}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Role-specific tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stock Alerts for Pharmacist */}
          {role === 'pharmacist' && stockAlerts.length > 0 && (
            <Card className="border-red-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Stock Alerts ({stockAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {stockAlerts.slice(0, 5).map((alert: any) => (
                    <div key={alert.id || alert.medicine_id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">{alert.medicine_name || alert.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.alert_type === 'low_stock' 
                            ? `Low stock: ${alert.current_stock} remaining`
                            : `Expiring: ${new Date(alert.expiry_date).toLocaleDateString()}`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/dashboard/${role}/inventory`)}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                  {stockAlerts.length > 5 && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => router.push(`/dashboard/${role}/stock-alerts`)}
                    >
                      View All Alerts ({stockAlerts.length})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {roleMetrics.map((metric) => (
              <Card key={metric.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center gap-2"
                    onClick={action.action}
                  >
                    <action.icon className="h-6 w-6" />
                    <span className="text-sm">{action.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4">
                    <activity.icon className={`h-5 w-5 ${activity.color}`} />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {activity.action}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patients Tab */}
        <TabsContent value="patients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Showing {patientCount.filtered} of {patientCount.total} patients
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </Button>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
                
                {/* Patient list would go here */}
                <div className="text-center py-8 text-muted-foreground">
                  Patient list component would be rendered here
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities Tab */}
        <TabsContent value="activities" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                    <activity.icon className={`h-5 w-5 ${activity.color}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reports & Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Reports and analytics would be rendered here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
