"use client"

import Link from "next/link"
import { Users, ArrowRight } from "lucide-react"

interface Patient {
  id: string
  patientNumber: string
  firstName: string
  lastName: string
  phone: string
  createdAt: string
}

interface RecentPatientsWidgetProps {
  patients: Patient[]
  className?: string
}

export function RecentPatientsWidget({ patients, className }: RecentPatientsWidgetProps) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Patients</h3>
        <Link
          href="/dashboard/patients"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
        >
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {patients.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No patients registered yet</p>
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => (
            <Link
              key={patient.id}
              href={`/dashboard/patients/${patient.id}`}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {patient.firstName} {patient.lastName}
                </p>
                <p className="text-xs text-gray-500">{patient.patientNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{patient.phone}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
