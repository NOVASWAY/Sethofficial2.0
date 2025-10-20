"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ThemeToggleSimple } from "@/components/theme-toggle-simple"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { useTranslation } from "@/contexts/language-context"
import {
  Heart,
  User,
  Shield,
  Pill,
  Users,
  Calendar,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  UserPlus,
  Receipt,
  Stethoscope,
  UserCog,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  Truck,
} from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
  role: string
}

const roleConfig = {
  receptionist: {
    label: "Receptionist",
    icon: User,
    color: "bg-blue-500",
    permissions: ["patients", "appointments", "invoices"],
  },
  nurse: {
    label: "Nurse",
    icon: UserCog,
    color: "bg-green-500",
    permissions: ["patients", "appointments", "visits", "reports"],
  },
  clinician: {
    label: "Clinician",
    icon: Stethoscope,
    color: "bg-primary",
    permissions: ["patients", "appointments", "visits", "reports", "prescriptions"],
  },
  pharmacist: {
    label: "Pharmacist",
    icon: Pill,
    color: "bg-accent",
    permissions: ["pharmacy", "inventory", "reports", "invoices", "patients"],
  },
  admin: {
    label: "Administrator",
    icon: Shield,
    color: "bg-destructive",
    permissions: ["patients", "appointments", "invoices", "pharmacy", "inventory", "reports", "settings", "users"],
  },
}

const navigationItems = [
  { id: "dashboard", labelKey: "navigation.dashboard", icon: Home, path: "/dashboard", permissions: ["all"] },
  { id: "registration", label: "Patient Registration", icon: UserPlus, path: "/registration", permissions: ["patients"] },
  { id: "consultation", label: "Consultation", icon: Stethoscope, path: "/consultation", permissions: ["visits"] },
  { id: "billing", label: "Billing & Invoicing", icon: Receipt, path: "/billing", permissions: ["invoices"] },
  { id: "pharmacy-dispensing", label: "Pharmacy Dispensing", icon: Pill, path: "/pharmacy-dispensing", permissions: ["pharmacy"] },
  { id: "appointments", label: "Appointments", icon: Calendar, path: "/appointments", permissions: ["appointments"] },
  { id: "queue", label: "Patient Queue", icon: Users, path: "/queue", permissions: ["visits", "patients"] },
  { id: "patients", label: "Patient Records", icon: Users, path: "/patients", permissions: ["patients"] },
  { id: "visits", label: "Visit History", icon: ClipboardList, path: "/visits", permissions: ["visits"] },
  {
    id: "prescriptions",
    label: "Prescriptions",
    icon: ClipboardList,
    path: "/prescriptions",
    permissions: ["prescriptions"],
  },
  { id: "invoices", label: "Invoice Records", icon: Receipt, path: "/invoices", permissions: ["invoices"] },
  { id: "pharmacy", label: "Pharmacy Management", icon: Pill, path: "/pharmacy", permissions: ["pharmacy"] },
  { id: "inventory", label: "Stock Management", icon: Package, path: "/inventory", permissions: ["inventory"] },
  { id: "stock-receiving", label: "Stock Receiving", icon: Truck, path: "/stock-receiving", permissions: ["inventory"] },
  { id: "expiry-alerts", label: "Expiry Alerts", icon: AlertTriangle, path: "/expiry-alerts", permissions: ["pharmacy", "inventory"] },
  { id: "services", label: "Service Catalog", icon: DollarSign, path: "/services", permissions: ["invoices", "settings"] },
  { id: "medicines", label: "Medicine Catalog", icon: Pill, path: "/medicines", permissions: ["pharmacy", "settings"] },
  { id: "financial-overview", label: "Financial Overview", icon: DollarSign, path: "/financial-overview", permissions: ["reports", "invoices"] },
  { id: "financial", label: "Financial Dashboard", icon: BarChart3, path: "/financial", permissions: ["reports", "invoices"] },
  { id: "inventory-reports", label: "Inventory Reports", icon: Package, path: "/inventory-reports", permissions: ["reports", "inventory"] },
  { id: "sha-tracking", label: "SHA Claim Tracking", icon: Shield, path: "/sha-tracking", permissions: ["reports", "invoices"] },
  { id: "reports", label: "Reports & Analytics", icon: BarChart3, path: "/reports", permissions: ["reports"] },
  { id: "audit-logs", label: "Audit Logs", icon: Shield, path: "/audit-logs", permissions: ["users", "settings"] },
  { id: "users", label: "User Management", icon: Users, path: "/users", permissions: ["users"] },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings", permissions: ["settings"] },
]

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeItem, setActiveItem] = useState("dashboard")
  const [mounted, setMounted] = useState(false)
  const { user, logout, isAuthenticated, isLoading } = useAuth()

  const currentRole = roleConfig[role as keyof typeof roleConfig]
  const RoleIcon = currentRole?.icon || User

  const filteredNavigation = navigationItems.filter(
    (item) =>
      item.permissions.includes("all") ||
      item.permissions.some((permission) => currentRole?.permissions.includes(permission)),
  )

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.push("/")
    }
  }, [mounted, isAuthenticated, isLoading, router])

  // Redirect if role doesn't match
  useEffect(() => {
    if (mounted && user && user.role !== role) {
      router.push(`/dashboard/${user.role}`)
    }
  }, [mounted, user, role, router])

  const handleLogout = () => {
    logout()
  }

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted || isLoading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-background border rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Loading dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-background border rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <div className="h-6 w-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Redirecting to login...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border">
            <SidebarContent
              role={role}
              currentRole={currentRole}
              RoleIcon={RoleIcon}
              filteredNavigation={filteredNavigation}
              activeItem={activeItem}
              setActiveItem={setActiveItem}
              onClose={() => setSidebarOpen(false)}
              handleLogout={handleLogout}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:left-0 lg:top-0 lg:h-full lg:w-64 lg:block">
        <div className="h-full bg-sidebar border-r border-sidebar-border">
          <SidebarContent
            role={role}
            currentRole={currentRole}
            RoleIcon={RoleIcon}
            filteredNavigation={filteredNavigation}
            activeItem={activeItem}
            setActiveItem={setActiveItem}
            handleLogout={handleLogout}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top header */}
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Seth Medical Clinic</h1>
                <p className="text-sm text-muted-foreground">Management System</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <LanguageSwitcher variant="select" className="hidden sm:flex" />
              <ThemeToggleSimple />
              <Badge variant="outline" className="hidden sm:flex">
                {currentRole?.label}
              </Badge>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}

interface SidebarContentProps {
  role: string
  currentRole: any
  RoleIcon: any
  filteredNavigation: any[]
  activeItem: string
  setActiveItem: (item: string) => void
  onClose?: () => void
  handleLogout: () => void
}

function SidebarContent({
  role,
  currentRole,
  RoleIcon,
  filteredNavigation,
  activeItem,
  setActiveItem,
  onClose,
  handleLogout,
}: SidebarContentProps) {
  const router = useRouter()
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col">
      {/* Sidebar header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sidebar-foreground">Seth Clinic</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* User info */}
      <div className="p-4 border-b border-sidebar-border">
        <Card className="p-3 bg-sidebar-accent">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 ${currentRole?.color} rounded-lg flex items-center justify-center`}>
              <RoleIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-sidebar-foreground">{currentRole?.label}</p>
              <p className="text-sm text-sidebar-foreground/70">Active Session</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredNavigation.map((item) => {
          const Icon = item.icon
          const isActive = activeItem === item.id
          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => {
                setActiveItem(item.id)
                if (item.id !== "dashboard") {
                  router.push(`/dashboard/${role}/${item.id}`)
                } else {
                  router.push(`/dashboard/${role}`)
                }
                onClose?.()
              }}
            >
              <Icon className="w-4 h-4 mr-3" />
              {item.labelKey ? t(item.labelKey) : item.label}
            </Button>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
