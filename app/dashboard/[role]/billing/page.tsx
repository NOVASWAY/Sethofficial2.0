'use client'

import { useParams } from 'next/navigation'
import { EnhancedBillingModule } from '@/components/enhanced-billing-module'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function BillingPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <EnhancedBillingModule />
    </DashboardLayout>
  )
}

