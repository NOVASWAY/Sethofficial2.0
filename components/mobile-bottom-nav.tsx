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

  const base = `/dashboard/${role}`

  const items = [
    {
      label: "Home",
      href: base,
      icon: <LayoutDashboard className="w-6 h-6" />,
      roles: ["admin", "receptionist", "clinician", "nurse", "pharmacist", "lab_technician", "doctor"],
    },
    {
      label: "Patients",
      href: `${base}/patients`,
      icon: <Users className="w-6 h-6" />,
      roles: ["admin", "receptionist", "clinician", "nurse", "doctor"],
    },
    {
      label: "Schedule",
      href: `${base}/appointments`,
      icon: <Calendar className="w-6 h-6" />,
      roles: ["admin", "receptionist", "clinician", "nurse", "doctor"],
    },
    {
      label: "Consult",
      href: `${base}/consultation`,
      icon: <Stethoscope className="w-6 h-6" />,
      roles: ["admin", "clinician", "doctor"],
    },
    {
      label: "Pharmacy",
      href: `${base}/pharmacy`,
      icon: <Pill className="w-6 h-6" />,
      roles: ["admin", "pharmacist"],
    },
    {
      label: "Billing",
      href: `${base}/invoices`,
      icon: <CreditCard className="w-6 h-6" />,
      roles: ["admin", "receptionist"],
    },
  ]

  const filteredItems = items.filter((item) => item.roles.includes(role))

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 rounded-lg transition-colors min-w-0 flex-1 min-h-[52px] py-1.5",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="text-[11px] font-medium truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
