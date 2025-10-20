"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from '@/components/dashboard-layout'
import { SHAClaimTracking } from '@/components/sha-claim-tracking'

export default function SHATrackingPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <SHAClaimTracking />
    </DashboardLayout>
  )
}

