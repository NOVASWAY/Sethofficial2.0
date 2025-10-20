"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PatientManagement } from "@/components/patient-management"

export default function PatientsPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <PatientManagement role={role} />
    </DashboardLayout>
  )
}
