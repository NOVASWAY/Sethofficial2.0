"use client"

import { Calendar, Clock, User } from "lucide-react"

interface Appointment {
  id: string
  time: string
  patientName: string
  type: string
  status: "scheduled" | "confirmed" | "in_progress" | "completed" | "cancelled"
}

interface ScheduleWidgetProps {
  appointments: Appointment[]
  className?: string
}

export function ScheduleWidget({ appointments, className }: ScheduleWidgetProps) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      confirmed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      in_progress: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      completed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    }
    return colors[status] || colors.scheduled
  }

  return (
    <div className={cn("bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">Today&apos;s Schedule</h3>
        <Calendar className="w-5 h-5 text-gray-400" />
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">No appointments today</p>
      ) : (
        <div className="space-y-3">
          {appointments.slice(0, 5).map((apt) => (
            <div
              key={apt.id}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-w-[70px]">
                <Clock className="w-4 h-4" />
                {apt.time}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {apt.patientName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{apt.type}</p>
              </div>
              <span
                className={`px-2 py-1 text-xs rounded-full capitalize ${getStatusColor(apt.status)}`}
              >
                {apt.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ")
}
