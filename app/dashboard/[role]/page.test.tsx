'use client'

import { useParams } from 'next/navigation'

export default function TestDashboardPage() {
  const params = useParams()
  const role = params?.role as string | undefined

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Dashboard Test Page</h1>
        <p>Role from params: {role || 'Not found'}</p>
        <p className="text-sm text-muted-foreground">
          If you see this, the route params are working!
        </p>
      </div>
    </div>
  )
}

