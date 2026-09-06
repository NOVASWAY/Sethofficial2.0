"use client"

import { useParams } from "next/navigation"
import { QueueManagement } from '@/components/queue-management'

export default function QueuePage() {
  const params = useParams()
  const role = params.role as string

  return (
      <QueueManagement />
  )
}

