'use client'

import { useParams } from 'next/navigation'
import { EnhancedBillingModule } from '@/components/enhanced-billing-module'
import { DashboardLayout } from '@/components/dashboard-layout'
import { InvoiceManagement } from '@/components/invoice-management'

export default function BillingPage() {
  const params = useParams()
  const role = params.role as string

  // Only receptionists and admins can create invoices
  // Other roles (clinicians, pharmacists) can only view invoices
  const canCreateInvoices = role === "receptionist" || role === "admin"

  return (
    <DashboardLayout role={role}>
      {canCreateInvoices ? (
        <EnhancedBillingModule role={role} />
      ) : (
        <InvoiceManagement role={role} />
      )}
    </DashboardLayout>
  )
}

