"use client"

import { useParams } from "next/navigation"
import { MedicineCatalog } from "@/components/medicine-catalog"

export default function MedicinesPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <MedicineCatalog role={role} />
  )
}

