"use client"

import { useParams } from "next/navigation"
import { ConsultationModule } from '@/components/consultation-module'
import { DashboardLayout } from '@/components/dashboard-layout'

export default function ConsultationPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <ConsultationModule />
    </DashboardLayout>
  )
}
