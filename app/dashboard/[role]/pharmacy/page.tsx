"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PharmacyManagement } from "@/components/pharmacy-management"

export default function PharmacyPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <PharmacyManagement role={role} />
    </DashboardLayout>
  )
}
