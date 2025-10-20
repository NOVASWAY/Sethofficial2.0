'use client'

import { useParams } from 'next/navigation'
import { WorkflowManagement } from '@/components/workflow-management'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function WorkflowPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <WorkflowManagement role={role} />
    </DashboardLayout>
  )
}
