'use client'

import { useParams } from 'next/navigation'
import { StockReconciliationModule } from '@/components/stock-reconciliation-module'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function StockReconciliationPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <StockReconciliationModule />
    </DashboardLayout>
  )
}

