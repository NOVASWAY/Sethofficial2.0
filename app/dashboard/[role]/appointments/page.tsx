"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from '@/components/dashboard-layout'
import { AppointmentBooking } from '@/components/appointment-booking'

export default function AppointmentsPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <AppointmentBooking />
    </DashboardLayout>
  )
}
