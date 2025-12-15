"use client"

import { useParams } from "next/navigation"
import { StockReceiving } from '@/components/stock-receiving'

export default function StockReceivingPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <StockReceiving />
  )
}

