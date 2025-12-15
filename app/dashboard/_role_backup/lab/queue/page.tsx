'use client'

import { useParams } from 'next/navigation'
import { LabTestQueue } from '@/components/lab-test-queue'

export default function LabQueuePage() {
  const params = useParams()
  const role = params.role as string

  return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lab Test Queue</h1>
          <p className="text-muted-foreground">
            Manage and process pending lab test orders
          </p>
        </div>
        <LabTestQueue />
      </div>
  )
}

