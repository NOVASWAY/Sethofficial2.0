'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, Calendar, DollarSign, Pill, Package, AlertTriangle, 
  Clock, FileText, Activity, Settings, BarChart3, TrendingUp,
  User, UserCog, Stethoscope, Shield, Bell, Star, Eye, EyeOff
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { usePatient } from '@/contexts/patient-context'
import { useInventory } from '@/contexts/inventory-context'

interface UserPreferences {
  dashboardLayout: 'compact' | 'detailed' | 'custom'
  defaultView: 'overview' | 'patients' | 'appointments' | 'reports'
  showNotifications: boolean
  autoRefresh: boolean
  refreshInterval: number
  favoriteModules: string[]
  customMetrics: string[]
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
}

interface UserActivity {
  id: string
  action: string
  module: string
  timestamp: Date
  details: string
  ipAddress: string
}

interface UserSpecificDashboardProps {
  role: string
}

export function UserSpecificDashboard({ role }: UserSpecificDashboardProps) {
  const { user } = useAuth()
  const { patientsData } = usePatient()
  const { medicines, stockMovements } = useInventory()
  
  const [preferences, setPreferences] = useState<UserPreferences>({
    dashboardLayout: 'detailed',
    defaultView: 'overview',
    showNotifications: true,
    autoRefresh: true,
    refreshInterval: 30,
    favoriteModules: [],
    customMetrics: [],
    theme: 'auto',
    language: 'en',
    timezone: 'Africa/Nairobi'
  })
  
  const [userActivity, setUserActivity] = useState<UserActivity[]>([])
  const [isCustomizing, setIsCustomizing] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])

  // Load user preferences
  useEffect(() => {
    if (user) {
      // Load from localStorage or API
      const savedPreferences = localStorage.getItem(`user_preferences_${user.id}`)
      if (savedPreferences) {
        setPreferences(JSON.parse(savedPreferences))
      }
      
      // Load user activity
      loadUserActivity()
    }
  }, [user])

  // Save preferences
  const savePreferences = (newPreferences: Partial<UserPreferences>) => {
    const updatedPreferences = { ...preferences, ...newPreferences }
    setPreferences(updatedPreferences)
    
    if (user) {
      localStorage.setItem(`user_preferences_${user.id}`, JSON.stringify(updatedPreferences))
      // TODO: Save to backend API
    }
  }

  // Load user activity
  const loadUserActivity = async () => {
    // Mock user activity data
    const mockActivity: UserActivity[] = [
      {
        id: '1',
        action: 'Patient Registration',
        module: 'Patients',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        details: 'Registered new patient: John Doe',
        ipAddress: '192.168.1.100'
      },
      {
        id: '2',
        action: 'Consultation',
        module: 'Consultations',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        details: 'Completed consultation for patient: Jane Smith',
        ipAddress: '192.168.1.100'
      },
      {
        id: '3',
        action: 'Prescription',
        module: 'Pharmacy',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
        details: 'Dispensed medication: Paracetamol 500mg',
        ipAddress: '192.168.1.100'
      }
    ]
    
    setUserActivity(mockActivity)
  }

  // Get role-specific metrics
  const getRoleSpecificMetrics = () => {
    const baseMetrics = [
      { id: 'total_patients', label: 'Total Patients', icon: Users, value: patientsData.size },
      { id: 'today_consultations', label: 'Today\'s Consultations', icon: FileText, value: 12 },
      { id: 'pending_prescriptions', label: 'Pending Prescriptions', icon: Pill, value: 8 },
      { id: 'low_stock_items', label: 'Low Stock Items', icon: AlertTriangle, value: 3 }
    ]

    switch (role) {
      case 'admin':
        return [
          ...baseMetrics,
          { id: 'total_revenue', label: 'Total Revenue', icon: DollarSign, value: 'KSh 1,250,000' },
          { id: 'active_users', label: 'Active Users', icon: User, value: 15 },
          { id: 'system_health', label: 'System Health', icon: Activity, value: '98%' }
        ]
      case 'receptionist':
        return [
          { id: 'new_patients_today', label: 'New Patients Today', icon: Users, value: 5 },
          { id: 'appointments_today', label: 'Appointments Today', icon: Calendar, value: 18 },
          { id: 'pending_registrations', label: 'Pending Registrations', icon: FileText, value: 2 }
        ]
      case 'nurse':
        return [
          { id: 'patients_seen_today', label: 'Patients Seen Today', icon: Users, value: 12 },
          { id: 'vitals_recorded', label: 'Vitals Recorded', icon: Activity, value: 15 },
          { id: 'pending_assessments', label: 'Pending Assessments', icon: Clock, value: 3 }
        ]
      case 'clinician':
        return [
          { id: 'consultations_today', label: 'Consultations Today', icon: Stethoscope, value: 8 },
          { id: 'prescriptions_written', label: 'Prescriptions Written', icon: Pill, value: 12 },
          { id: 'diagnoses_made', label: 'Diagnoses Made', icon: FileText, value: 8 }
        ]
      case 'pharmacist':
        return [
          { id: 'prescriptions_dispensed', label: 'Prescriptions Dispensed', icon: Pill, value: 15 },
          { id: 'stock_movements', label: 'Stock Movements', icon: Package, value: 8 },
          { id: 'expiry_alerts', label: 'Expiry Alerts', icon: AlertTriangle, value: 2 }
        ]
      default:
        return baseMetrics
    }
  }

  // Get user-specific data
  const getUserSpecificData = () => {
    if (!user) return null

    return {
      userInfo: {
        name: user.name,
        role: user.role,
        department: user.department,
        lastLogin: new Date().toLocaleDateString(),
        totalActions: userActivity.length
      },
      todayStats: {
        patientsHandled: userActivity.filter(a => a.module === 'Patients').length,
        consultationsCompleted: userActivity.filter(a => a.module === 'Consultations').length,
        prescriptionsProcessed: userActivity.filter(a => a.module === 'Pharmacy').length
      },
      recentActivity: userActivity.slice(0, 5)
    }
  }

  const userData = getUserSpecificData()
  const roleMetrics = getRoleSpecificMetrics()

  if (!user || !userData) {
    return <div>Loading user dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome back, {userData.userInfo.name}
          </h2>
          <p className="text-muted-foreground">
            {userData.userInfo.role} • {userData.userInfo.department}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCustomizing(!isCustomizing)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Customize
          </Button>
        </div>
      </div>

      {/* Customization Panel */}
      {isCustomizing && (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard Customization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Dashboard Layout</Label>
                <Select
                  value={preferences.dashboardLayout}
                  onValueChange={(value: 'compact' | 'detailed' | 'custom') => 
                    savePreferences({ dashboardLayout: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Default View</Label>
                <Select
                  value={preferences.defaultView}
                  onValueChange={(value: 'overview' | 'patients' | 'appointments' | 'reports') => 
                    savePreferences({ defaultView: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overview">Overview</SelectItem>
                    <SelectItem value="patients">Patients</SelectItem>
                    <SelectItem value="appointments">Appointments</SelectItem>
                    <SelectItem value="reports">Reports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="notifications"
                checked={preferences.showNotifications}
                onCheckedChange={(checked) => savePreferences({ showNotifications: checked })}
              />
              <Label htmlFor="notifications">Show Notifications</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="auto-refresh"
                checked={preferences.autoRefresh}
                onCheckedChange={(checked) => savePreferences({ autoRefresh: checked })}
              />
              <Label htmlFor="auto-refresh">Auto Refresh</Label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Actions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userData.todayStats.patientsHandled + userData.todayStats.consultationsCompleted + userData.todayStats.prescriptionsProcessed}</div>
            <p className="text-xs text-muted-foreground">
              {userData.todayStats.patientsHandled} patients, {userData.todayStats.consultationsCompleted} consultations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Login</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userData.userInfo.lastLogin}</div>
            <p className="text-xs text-muted-foreground">
              Session active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userData.userInfo.totalActions}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Role</CardTitle>
            <Badge variant="outline" className="capitalize">
              {userData.userInfo.role}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userData.userInfo.department}</div>
            <p className="text-xs text-muted-foreground">
              Department
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Role-Specific Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roleMetrics.map((metric) => (
          <Card key={metric.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userData.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-4">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {activity.action}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {activity.details}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {activity.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
