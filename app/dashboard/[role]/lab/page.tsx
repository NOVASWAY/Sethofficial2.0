'use client'

import { useParams } from 'next/navigation'
import { LabTechnicianDashboard } from '@/components/lab-technician-dashboard'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function LabDashboardPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <LabTechnicianDashboard />
    </DashboardLayout>
  )
}

