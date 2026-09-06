'use client'

import { useParams } from 'next/navigation'
import { LabTechnicianDashboard } from '@/components/lab-technician-dashboard'

export default function LabDashboardPage() {
  const params = useParams()
  const role = params.role as string

  return (
    <>
      {/* ZERO TRUST: Access Control */}
      {(role === 'lab_technician' || role === 'admin' || role === 'clinician' || role === 'doctor') ? (
        <LabTechnicianDashboard />
      ) : (
        <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-full bg-red-100 text-red-600">
            <span role="img" aria-label="denied" className="text-4xl">🚫</span>
          </div>
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">You do not have permission to access the Laboratory Dashboard.</p>
        </div>
      )}
    </>
  )
}
