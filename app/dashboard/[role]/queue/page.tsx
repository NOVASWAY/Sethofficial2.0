"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from '@/components/dashboard-layout'
import { QueueManagement } from '@/components/queue-management'

export default function QueuePage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <QueueManagement />
    </DashboardLayout>
  )
}

