"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardSkeleton } from "@/components/ui/loading"

// Lazy load dashboard overview for better performance
const DashboardOverview = dynamic(
  () => import("@/components/dashboard-overview"),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false, // Disable SSR for faster initial load
  }
)

export default function DashboardPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardOverview role={role} />
      </Suspense>
    </DashboardLayout>
  )
}
