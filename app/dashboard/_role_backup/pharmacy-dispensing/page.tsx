'use client'

import { useParams } from 'next/navigation'
import { PharmacyDispensingModule } from '@/components/pharmacy-dispensing-module'

export default function PharmacyDispensingPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <PharmacyDispensingModule />
  )
}

