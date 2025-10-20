"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ReportsModule } from "@/components/reports-module"

export default function ReportsPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <ReportsModule />
    </DashboardLayout>
  )
}
