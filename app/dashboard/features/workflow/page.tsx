'use client'

import { useParams } from 'next/navigation'
import { WorkflowManagement } from '@/components/workflow-management'

export default function WorkflowPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <WorkflowManagement role={role} />
  )
}
