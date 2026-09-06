'use client'

import { useMemo, Suspense } from 'react'
import { RoleSpecificDashboard } from '@/components/dashboard/role-specific-dashboard'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'

export default function DashboardRolePage() {
  const params = useParams()
  const { user } = useAuth()

  const role = useMemo(() => {
    if (!params || typeof params !== 'object') return undefined
    const roleParam = params.role
    return typeof roleParam === 'string' ? roleParam : undefined
  }, [params])

  const dashboardRole = useMemo(() => {
    return role || user?.role || 'receptionist'
  }, [role, user?.role])

  return (
    <DashboardLayout role={dashboardRole}>
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
        <RoleSpecificDashboard role={dashboardRole} />
      </Suspense>
    </DashboardLayout>
  )
}
