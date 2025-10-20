"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardOverview } from "@/components/dashboard-overview"

export default function DashboardPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <DashboardOverview role={role} />
    </DashboardLayout>
  )
}
