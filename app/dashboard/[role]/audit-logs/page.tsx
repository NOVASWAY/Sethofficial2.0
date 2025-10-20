"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from '@/components/dashboard-layout'
import { AuditLogs } from '@/components/audit-logs'

export default function AuditLogsPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <AuditLogs />
    </DashboardLayout>
  )
}

