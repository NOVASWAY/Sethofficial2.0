"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from '@/components/dashboard-layout'
import { InventoryReports } from '@/components/inventory-reports'

export default function InventoryReportsPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <InventoryReports />
    </DashboardLayout>
  )
}

