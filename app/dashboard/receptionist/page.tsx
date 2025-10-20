"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardOverview } from "@/components/dashboard-overview"

export default function ReceptionistDashboardPage() {
  return (
    <DashboardLayout role="receptionist">
      <DashboardOverview role="receptionist" />
    </DashboardLayout>
  )
}

