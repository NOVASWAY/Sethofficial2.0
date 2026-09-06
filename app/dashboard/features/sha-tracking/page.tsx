"use client"

import { useParams } from "next/navigation"
import { SHAClaimTracking } from '@/components/sha-claim-tracking'

export default function SHATrackingPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <SHAClaimTracking />
  )
}

