"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from '@/components/dashboard-layout'
import { StockReceiving } from '@/components/stock-receiving'

export default function StockReceivingPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <StockReceiving />
    </DashboardLayout>
  )
}

