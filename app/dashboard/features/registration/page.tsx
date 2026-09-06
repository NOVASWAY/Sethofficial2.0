'use client'

import { useParams } from 'next/navigation'
import { RegistrationModule } from '@/components/registration-module'

export default function RegistrationPage() {
  const params = useParams()
  const role = params.role as string

  return (
      <RegistrationModule />
  )
}

