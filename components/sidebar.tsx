"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  FileText,
  Pill,
  TestTube,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Menu,
  X,
  UserCog,
  BarChart3,
  Activity,
} from "lucide-react"
import { useTheme } from "next-themes"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
  roles?: string[]
}

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
  {
    label: "Patients",
    href: "/dashboard/patients",
    icon: <Users className="w-5 h-5" />,
    roles: ["admin", "receptionist", "clinician", "nurse"],
  },
  {
    label: "Appointments",
    href: "/dashboard/appointments",
    icon: <Calendar className="w-5 h-5" />,
    roles: ["admin", "receptionist", "clinician", "nurse"],
  },
  {
    label: "Consultations",
    href: "/dashboard/consultations",
    icon: <Stethoscope className="w-5 h-5" />,
    roles: ["admin", "clinician"],
  },
  {
    label: "Prescriptions",
    href: "/dashboard/prescriptions",
    icon: <FileText className="w-5 h-5" />,
    roles: ["admin", "clinician", "pharmacist"],
  },
  {
    label: "Pharmacy",
    href: "/dashboard/pharmacy",
    icon: <Pill className="w-5 h-5" />,
    roles: ["admin", "pharmacist"],
  },
  {
    label: "Laboratory",
    href: "/dashboard/laboratory",
    icon: <TestTube className="w-5 h-5" />,
    roles: ["admin", "clinician", "lab_technician", "nurse"],
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
    icon: <CreditCard className="w-5 h-5" />,
    roles: ["admin", "receptionist"],
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "User Management",
    href: "/dashboard/users",
    icon: <UserCog className="w-5 h-5" />,
    roles: ["admin"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: <Settings className="w-5 h-5" />,
    roles: ["admin"],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const userRole = session?.user?.role || "receptionist"

  const filteredNav = navigation.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  )

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
      clinician: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
      nurse: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
      pharmacist: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      lab_technician: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
      receptionist: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
    }
    return colors[role] || "bg-gray-100 text-gray-700"
  }

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full z-50 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 flex flex-col",
          collapsed ? "w-20" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 dark:text-white">Seth Medical</h1>
                <p className="text-xs text-gray-500">Clinic Management</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
                title={collapsed ? item.label : undefined}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.badge && (
                  <span className="ml-auto px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium">
                {session?.user?.name ? getInitials(session.user.name) : "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {session?.user?.name || "User"}
                </p>
                <span
                  className={cn(
                    "inline-block px-2 py-0.5 text-xs rounded-full capitalize",
                    getRoleBadgeColor(userRole)
                  )}
                >
                  {userRole.replace("_", " ")}
                </span>
              </div>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium">
                {session?.user?.name ? getInitials(session.user.name) : "U"}
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-red-500"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          )}
        </div>
      </aside>
    </>
  )
}
