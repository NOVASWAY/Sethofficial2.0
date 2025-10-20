"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { InvoiceManagement } from "@/components/invoice-management"

export default function InvoicesPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <InvoiceManagement role={role} />
    </DashboardLayout>
  )
}
