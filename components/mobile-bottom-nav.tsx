"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  CreditCard,
  Pill,
} from "lucide-react"

export function MobileBottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const role = session?.user?.role || "receptionist"

  const items = [
    {
      label: "Home",
      href: "/dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
      roles: ["admin", "receptionist", "clinician", "nurse", "pharmacist", "lab_technician"],
    },
    {
      label: "Patients",
      href: "/dashboard/patients",
      icon: <Users className="w-5 h-5" />,
      roles: ["admin", "receptionist", "clinician", "nurse"],
    },
    {
      label: "Schedule",
      href: "/dashboard/appointments",
      icon: <Calendar className="w-5 h-5" />,
      roles: ["admin", "receptionist", "clinician", "nurse"],
    },
    {
      label: "Consult",
      href: "/dashboard/consultations",
      icon: <Stethoscope className="w-5 h-5" />,
      roles: ["admin", "clinician"],
    },
    {
      label: "Pharmacy",
      href: "/dashboard/pharmacy",
      icon: <Pill className="w-5 h-5" />,
      roles: ["admin", "pharmacist"],
    },
    {
      label: "Billing",
      href: "/dashboard/billing",
      icon: <CreditCard className="w-5 h-5" />,
      roles: ["admin", "receptionist"],
    },
  ]

  const filteredItems = items.filter((item) => item.roles.includes(role))

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-0 flex-1",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400"
              )}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
