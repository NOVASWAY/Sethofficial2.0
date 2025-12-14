"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import dynamic from "next/dynamic"
import { DashboardLayout } from '@/components/dashboard-layout'
import { CardSkeleton } from '@/components/ui/loading'

// Lazy load consultation module for better performance
const ConsultationModule = dynamic(
  () => import('@/components/consultation-module'),
  {
    loading: () => <CardSkeleton />,
    ssr: false,
  }
)

export default function ConsultationPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <Suspense fallback={<CardSkeleton />}>
        <ConsultationModule />
      </Suspense>
    </DashboardLayout>
  )
}
