"use client"

import { FinancialOverview } from "@/components/financial-overview"
import { useParams } from "next/navigation"

export default function FinancialOverviewPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <FinancialOverview />
  )
}

