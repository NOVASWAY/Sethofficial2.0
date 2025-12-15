'use client'

import { useState, useMemo, Suspense } from 'react'
import { RoleSpecificDashboard } from '@/components/dashboard/role-specific-dashboard'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import dynamic from 'next/dynamic'

// Lazy load dashboard components to prevent initial bundle issues
const DashboardOverview = dynamic(() => import('@/components/dashboard-overview'), { 
  ssr: false,
  loading: () => <div className="p-6 text-center text-muted-foreground">Loading overview dashboard...</div>
})
const UserSpecificDashboard = dynamic(() => import('@/components/dashboard/user-specific-dashboard').then(mod => ({ default: mod.UserSpecificDashboard })), { 
  ssr: false,
  loading: () => <div className="p-6 text-center text-muted-foreground">Loading user dashboard...</div>
})
const RealtimeDashboardOverview = dynamic(() => import('@/components/realtime-dashboard-overview').then(mod => ({ default: mod.RealtimeDashboardOverview })), { 
  ssr: false,
  loading: () => <div className="p-6 text-center text-muted-foreground">Loading real-time dashboard...</div>
})
const FinancialDashboard = dynamic(() => import('@/components/dashboard/financial-dashboard'), { 
  ssr: false,
  loading: () => <div className="p-6 text-center text-muted-foreground">Loading financial dashboard...</div>
})

type DashboardType = 'role-specific' | 'overview' | 'user-specific' | 'realtime' | 'financial'

function DashboardSwitcher({ 
  dashboardType, 
  onDashboardChange, 
  dashboardRole 
}: { 
  dashboardType: DashboardType
  onDashboardChange: (value: DashboardType) => void
  dashboardRole: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle>Dashboard Views</CardTitle>
            <CardDescription>
              Switch between different dashboard views to access various insights and features
            </CardDescription>
          </div>
          <Select value={dashboardType} onValueChange={(value) => onDashboardChange(value as DashboardType)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select dashboard view" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="role-specific">Role-Specific Dashboard</SelectItem>
              <SelectItem value="overview">Overview Dashboard</SelectItem>
              <SelectItem value="user-specific">User-Specific Dashboard</SelectItem>
              <SelectItem value="realtime">Real-Time Dashboard</SelectItem>
              {(dashboardRole === 'admin' || dashboardRole === 'receptionist') && (
                <SelectItem value="financial">Financial Dashboard</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
    </Card>
  )
}

function DashboardContent({ 
  dashboardType, 
  dashboardRole, 
  userId, 
  department 
}: { 
  dashboardType: DashboardType
  dashboardRole: string
  userId: string
  department: string
}) {
  switch (dashboardType) {
    case 'role-specific':
      return <RoleSpecificDashboard role={dashboardRole} />
    case 'overview':
      return <DashboardOverview role={dashboardRole} />
    case 'user-specific':
      return <UserSpecificDashboard role={dashboardRole} />
    case 'realtime':
      return (
        <RealtimeDashboardOverview 
          role={dashboardRole}
          userId={userId}
          department={department}
          enableRealtime={true}
        />
      )
    case 'financial':
      return <FinancialDashboard />
    default:
      return <RoleSpecificDashboard role={dashboardRole} />
  }
}

export default function DashboardRolePage() {
  const params = useParams()
  const { user } = useAuth()
  const [dashboardType, setDashboardType] = useState<DashboardType>('role-specific')
  
  // Extract role from params safely
  const role = useMemo(() => {
    if (!params || typeof params !== 'object') return undefined
    const roleParam = params.role
    return typeof roleParam === 'string' ? roleParam : undefined
  }, [params])

  // Use the role from params or fall back to user role
  const dashboardRole = useMemo(() => {
    return role || user?.role || 'receptionist'
  }, [role, user?.role])

  return (
    <DashboardLayout role={dashboardRole}>
      <div className="space-y-6">
        <DashboardSwitcher 
          dashboardType={dashboardType}
          onDashboardChange={setDashboardType}
          dashboardRole={dashboardRole}
        />
        
        <Suspense fallback={
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-muted-foreground">Loading dashboard...</span>
              </div>
            </CardContent>
          </Card>
        }>
          <DashboardContent 
            dashboardType={dashboardType}
            dashboardRole={dashboardRole}
            userId={user?.id || ''}
            department={user?.department || ''}
          />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}

