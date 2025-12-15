'use client'

import { useParams } from 'next/navigation'
import { StockReconciliationModule } from '@/components/stock-reconciliation-module'

export default function StockReconciliationPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <StockReconciliationModule />
  )
}

