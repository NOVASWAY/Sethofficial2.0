"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from '@/components/dashboard-layout'
import { ExpiryAlertsDashboard } from '@/components/expiry-alerts-dashboard'

export default function ExpiryAlertsPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <ExpiryAlertsDashboard />
    </DashboardLayout>
  )
}

