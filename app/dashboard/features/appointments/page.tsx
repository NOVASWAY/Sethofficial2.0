"use client"

import { useParams } from "next/navigation"
import { AppointmentBooking } from '@/components/appointment-booking'

export default function AppointmentsPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <AppointmentBooking />
  )
}
