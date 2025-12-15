"use client"

import { useParams } from "next/navigation"
import { AuditLogs } from '@/components/audit-logs'

export default function AuditLogsPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <AuditLogs />
  )
}

