"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardOverview } from "@/components/dashboard-overview"

export default function AdminDashboardPage() {
  return (
    <DashboardLayout role="admin">
      <DashboardOverview role="admin" />
    </DashboardLayout>
  )
}

