"use client"

import { useParams } from "next/navigation"
import { PharmacyManagement } from "@/components/pharmacy-management"

export default function PharmacyPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <PharmacyManagement role={role} />
  )
}
