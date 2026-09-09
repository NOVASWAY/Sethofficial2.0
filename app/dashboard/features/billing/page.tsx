'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { EnhancedBillingModule } from '@/components/enhanced-billing-module'
import { InvoiceManagement } from '@/components/invoice-management'
import { useWorkflow } from '@/contexts/workflow-context'

export default function BillingPage() {
  const params = useParams()
  const role = params.role as string
  const { pendingConsultation, setPendingConsultation } = useWorkflow()

  // Only receptionists and admins can create invoices
  // Other roles (clinicians, pharmacists) can only view invoices
  const canCreateInvoices = role === "receptionist" || role === "admin"

  // Consume the pending consultation once (clinician handoff), then clear it
  // so a stale consult can't be billed twice.
  useEffect(() => {
    if (!pendingConsultation) return
    const timer = setTimeout(() => setPendingConsultation(null), 30 * 60 * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingConsultation?.consultation_id])

  return (
    canCreateInvoices ? (
      <EnhancedBillingModule
        role={role}
        patientId={pendingConsultation?.patient_id || ''}
        patientName={pendingConsultation?.patient_name || ''}
        consultationId={pendingConsultation?.consultation_id || ''}
      />
    ) : (
      <InvoiceManagement role={role} />
    )
  )
}
