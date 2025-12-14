"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { DashboardLayout } from "@/components/dashboard-layout"
import { PatientListSkeleton } from "@/components/ui/loading"

// Lazy load patient management for better performance
const PatientManagement = dynamic(
  () => import("@/components/patient-management"),
  {
    loading: () => <PatientListSkeleton count={8} />,
    ssr: false,
  }
)

export default function PatientsPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <Suspense fallback={<PatientListSkeleton count={8} />}>
        <PatientManagement role={role} />
      </Suspense>
    </DashboardLayout>
  )
}
