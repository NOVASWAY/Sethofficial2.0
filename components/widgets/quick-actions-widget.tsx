"use client"

import Link from "next/link"
import {
  UserPlus,
  CalendarPlus,
  FileText,
  Pill,
  TestTube,
  CreditCard,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

interface QuickAction {
  label: string
  href: string
  icon: React.ReactNode
  color: string
  roles: string[]
}

const quickActions: QuickAction[] = [
  {
    label: "New Patient",
    href: "/dashboard/patients/new",
    icon: <UserPlus className="w-5 h-5" />,
    color: "bg-blue-500",
    roles: ["admin", "receptionist"],
  },
  {
    label: "Book Appointment",
    href: "/dashboard/appointments/new",
    icon: <CalendarPlus className="w-5 h-5" />,
    color: "bg-green-500",
    roles: ["admin", "receptionist"],
  },
  {
    label: "New Consultation",
    href: "/dashboard/consultations/new",
    icon: <FileText className="w-5 h-5" />,
    color: "bg-indigo-500",
    roles: ["admin", "doctor", "clinician"],
  },
  {
    label: "Dispense Medicine",
    href: "/dashboard/pharmacy/dispense",
    icon: <Pill className="w-5 h-5" />,
    color: "bg-purple-500",
    roles: ["admin", "pharmacist"],
  },
  {
    label: "Lab Order",
    href: "/dashboard/laboratory/new",
    icon: <TestTube className="w-5 h-5" />,
    color: "bg-orange-500",
    roles: ["admin", "doctor", "clinician"],
  },
  {
    label: "New Invoice",
    href: "/dashboard/billing/new",
    icon: <CreditCard className="w-5 h-5" />,
    color: "bg-emerald-500",
    roles: ["admin", "receptionist"],
  },
]

interface QuickActionsWidgetProps {
  className?: string
}

export function QuickActionsWidget({ className }: QuickActionsWidgetProps) {
  const { data: session } = useSession()
  const role = session?.user?.role || "receptionist"

  const filteredActions = quickActions.filter((action) =>
    action.roles.includes(role)
  )

  return (
    <div className={cn("bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4", className)}>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {filteredActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className={cn("p-2.5 rounded-lg text-white", action.color)}>
              {action.icon}
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center">
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
