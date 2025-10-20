"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardOverview } from "@/components/dashboard-overview"

export default function ClinicianDashboardPage() {
  return (
    <DashboardLayout role="clinician">
      <DashboardOverview role="clinician" />
    </DashboardLayout>
  )
}

