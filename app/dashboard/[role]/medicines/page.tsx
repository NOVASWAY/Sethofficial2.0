"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { MedicineCatalog } from "@/components/medicine-catalog"

export default function MedicinesPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <DashboardLayout role={role}>
      <MedicineCatalog role={role} />
    </DashboardLayout>
  )
}

