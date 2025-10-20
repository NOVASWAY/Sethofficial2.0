'use client'

import { useParams } from 'next/navigation'
import { RegistrationModule } from '@/components/registration-module'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function RegistrationPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <RegistrationModule />
    </DashboardLayout>
  )
}

