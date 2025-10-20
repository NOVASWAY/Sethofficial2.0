'use client'

import { useParams } from 'next/navigation'
import { PharmacyDispensingModule } from '@/components/pharmacy-dispensing-module'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function PharmacyDispensingPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <PharmacyDispensingModule />
    </DashboardLayout>
  )
}

