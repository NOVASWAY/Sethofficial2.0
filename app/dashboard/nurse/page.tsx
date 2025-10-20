"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardOverview } from "@/components/dashboard-overview"

export default function NurseDashboardPage() {
  return (
    <DashboardLayout role="nurse">
      <DashboardOverview role="nurse" />
    </DashboardLayout>
  )
}

