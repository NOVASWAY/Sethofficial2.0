"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardOverview } from "@/components/dashboard-overview"

export default function PharmacistDashboardPage() {
  return (
    <DashboardLayout role="pharmacist">
      <DashboardOverview role="pharmacist" />
    </DashboardLayout>
  )
}

