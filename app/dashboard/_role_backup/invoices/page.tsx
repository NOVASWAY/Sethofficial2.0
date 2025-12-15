"use client"

import { useParams } from "next/navigation"
import { InvoiceManagement } from "@/components/invoice-management"

export default function InvoicesPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <InvoiceManagement role={role} />
  )
}
