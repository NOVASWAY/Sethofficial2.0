"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ThemeToggleSimple } from "@/components/theme-toggle-simple"
import { LanguageSwitcher } from "@/components/language-switcher"
import { NotificationCenter } from "@/components/notification-center"
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
  FlaskConical,
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
  FileText,
  ChevronDown,
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
    permissions: ["patients", "appointments", "invoices", "visits"], // Added "visits" to see consultation history for billing
  },
  nurse: {
    label: "Nurse",
    icon: UserCog,
    color: "bg-green-500",
    permissions: ["patients", "appointments", "visits", "reports", "prescriptions"], // Added "prescriptions" to view patient prescriptions
  },
  doctor: {
    label: "Doctor",
    icon: Stethoscope,
    color: "bg-primary",
    permissions: ["patients", "appointments", "visits", "reports", "prescriptions", "invoices"], // Same as clinician
  },
  clinician: {
    label: "Clinician",
    icon: Stethoscope,
    color: "bg-primary",
    permissions: ["patients", "appointments", "visits", "reports", "prescriptions", "invoices"], // Added "invoices" to view invoices for own consultations
  },
  pharmacist: {
    label: "Pharmacist",
    icon: Pill,
    color: "bg-accent",
    permissions: ["pharmacy", "inventory", "reports", "invoices", "patients", "prescriptions"], // Added "prescriptions" to view prescriptions to dispense
  },
  lab_technician: {
    label: "Lab Technician",
    icon: FlaskConical,
    color: "bg-purple-500",
    permissions: ["lab", "lab_orders", "lab_results", "patients"],
  },
  admin: {
    label: "Administrator",
    icon: Shield,
    color: "bg-destructive",
    permissions: ["all"], // Admin has access to everything
  },
}

// Organized navigation items by category for better UX
const navigationItems = [
  // === CORE OPERATIONS ===
  { id: "dashboard", labelKey: "navigation.dashboard", icon: Home, path: "/dashboard", permissions: ["all"], category: "core" },
  { id: "queue", label: "Patient Queue", icon: Users, path: "/queue", permissions: ["visits", "patients", "appointments"], category: "core" },

  // === PATIENT MANAGEMENT ===
  { id: "registration", label: "Patient Registration", icon: UserPlus, path: "/registration", permissions: ["patients"], category: "patients" },
  { id: "patients", label: "Patient Records", icon: Users, path: "/patients", permissions: ["patients"], category: "patients" },
  { id: "visits", label: "Visit History", icon: ClipboardList, path: "/visits", permissions: ["visits"], category: "patients" },
  { id: "appointments", label: "Appointments", icon: Calendar, path: "/appointments", permissions: ["appointments"], category: "patients" },

  // === CLINICAL SERVICES ===
  { id: "consultation", label: "Consultation", icon: Stethoscope, path: "/consultation", permissions: ["visits"], category: "clinical" },
  {
    id: "prescriptions",
    label: "Prescriptions",
    icon: ClipboardList,
    path: "/prescriptions",
    permissions: ["prescriptions"],
    category: "clinical",
  },
  { id: "lab-dashboard", label: "Lab Dashboard", icon: FlaskConical, path: "/lab", permissions: ["lab", "lab_orders", "lab_results"], category: "clinical" },
  { id: "lab-queue", label: "Lab Queue", icon: FlaskConical, path: "/lab/queue", permissions: ["lab", "lab_orders"], category: "clinical" },
  { id: "lab-results", label: "Lab Results", icon: FileText, path: "/lab/results", permissions: ["lab", "lab_results"], category: "clinical" },

  // === PHARMACY ===
  { id: "pharmacy-dispensing", label: "Pharmacy Dispensing", icon: Pill, path: "/pharmacy-dispensing", permissions: ["pharmacy"], category: "pharmacy" },
  { id: "pharmacy", label: "Pharmacy Management", icon: Pill, path: "/pharmacy", permissions: ["pharmacy"], category: "pharmacy" },

  // === BILLING & FINANCIAL ===
  { id: "billing", label: "Billing & Invoicing", icon: Receipt, path: "/billing", permissions: ["invoices"], category: "billing" },
  { id: "invoices", label: "Invoice Records", icon: Receipt, path: "/invoices", permissions: ["invoices"], category: "billing" },
  { id: "financial-overview", label: "Financial Overview", icon: DollarSign, path: "/financial-overview", permissions: ["reports", "invoices"], category: "billing" },
  { id: "sha-tracking", label: "SHA Claim Tracking", icon: Shield, path: "/sha-tracking", permissions: ["reports", "invoices"], category: "billing" },

  // === INVENTORY ===
  { id: "inventory", label: "Stock Management", icon: Package, path: "/inventory", permissions: ["inventory"], category: "inventory" },
  { id: "stock-receiving", label: "Stock Receiving", icon: Truck, path: "/stock-receiving", permissions: ["inventory", "pharmacy"], category: "inventory" },
  { id: "stock-reconciliation", label: "Stock Reconciliation", icon: Package, path: "/stock-reconciliation", permissions: ["inventory", "pharmacy"], category: "inventory" },
  { id: "expiry-alerts", label: "Expiry Alerts", icon: AlertTriangle, path: "/expiry-alerts", permissions: ["pharmacy", "inventory"], category: "inventory" },

  // === CATALOGS & SETTINGS ===
  { id: "services", label: "Service Catalog", icon: DollarSign, path: "/services", permissions: ["invoices", "settings"], category: "catalog" },
  { id: "medicines", label: "Medicine Catalog", icon: Pill, path: "/medicines", permissions: ["pharmacy", "settings"], category: "catalog" },

  // === REPORTS & ANALYTICS ===
  { id: "reports", label: "Reports & Analytics", icon: BarChart3, path: "/reports", permissions: ["reports"], category: "reports" },
  { id: "inventory-reports", label: "Inventory Reports", icon: Package, path: "/inventory-reports", permissions: ["reports", "inventory"], category: "reports" },

  // === ADMINISTRATION ===
  { id: "workflow", label: "Workflow Management", icon: FileText, path: "/workflow", permissions: ["all"], category: "admin" },
  { id: "users", label: "User Management", icon: Users, path: "/users", permissions: ["users"], category: "admin" },
  { id: "audit-logs", label: "Audit Logs", icon: Shield, path: "/audit-logs", permissions: ["users", "settings"], category: "admin" },
  { id: "settings", label: "Settings", icon: Settings, path: "/settings", permissions: ["settings"], category: "admin" },
]

// Category labels for grouping
const categoryLabels: Record<string, string> = {
  core: "Core Operations",
  patients: "Patient Management",
  clinical: "Clinical Services",
  pharmacy: "Pharmacy",
  billing: "Billing & Financial",
  inventory: "Inventory",
  catalog: "Catalogs",
  reports: "Reports & Analytics",
  admin: "Administration",
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { user, logout, isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()
  const currentRole = roleConfig[role as keyof typeof roleConfig]
  const RoleIcon = currentRole?.icon || User

  // Ensure currentRole exists to prevent errors
  if (!currentRole) {
    console.error('⚠️ Unknown role:', role, 'Available roles:', Object.keys(roleConfig))
  }

  // Use user-specific permissions if available, otherwise fall back to role defaults
  // Admin users should have "all" permission to access everything
  const activePermissions = user?.permissions && Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions
    : (currentRole?.permissions || [])
  
  // Admin role should always have access to all modules
  const isAdminUser = role === 'admin' || user?.role === 'admin'

  // Filter navigation items based on permissions
  // Admin users see all navigation items
  const filteredNavigation = isAdminUser
    ? navigationItems // Admin sees everything
    : navigationItems.filter(
        (item) =>
          item.permissions.includes("all") ||
          item.permissions.some((permission) => activePermissions.includes(permission)),
      )

  // Debug logging for admin access
  useEffect(() => {
    if (isAdminUser) {
      console.log('[DashboardLayout] Admin user detected:', {
        role,
        userRole: user?.role,
        isAdminUser,
        navigationItemsCount: navigationItems.length,
        filteredNavigationCount: filteredNavigation?.length || 0
      })
    }
  }, [isAdminUser, role, user?.role, filteredNavigation])

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  // Derived active item from pathname to prevent flicker
  const activeItem = pathname ? (() => {
    const pathParts = pathname.split('/')
    const currentPage = pathParts[pathParts.length - 1] || 'dashboard'

    // Find matching navigation item
    const matchingItem = navigationItems.find(item => {
      if (item.id === 'dashboard' && (currentPage === role || currentPage === '')) {
        return true
      }
      return item.id === currentPage
    })

    return matchingItem ? matchingItem.id : "dashboard"
  })() : "dashboard"

  // Redirect to login if not authenticated
  useEffect(() => {
    if (mounted && !isLoading && !isAuthenticated) {
      router.push("/")
    }
  }, [mounted, isAuthenticated, isLoading, router])

  // Redirect if role doesn't match (but allow admin users to access any role's dashboard)
  useEffect(() => {
    if (mounted && user && user.role !== role && user.role !== 'admin') {
      // Admin users can access any role's dashboard, so skip redirect for them
      // PRESERVE THE SUBPATH when redirecting!
      if (pathname) {
        const pathParts = pathname.split('/')
        // pathParts: ["", "dashboard", "role", "feature"]
        if (pathParts[2] === role) {
          pathParts[2] = user.role
          const newPath = pathParts.join('/')
          router.push(newPath)
          return
        }
      }
      // Fallback if path parsing fails
      router.push(`/dashboard/${user.role}`)
    }
  }, [mounted, user, role, router, pathname])

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

  // ROUTE GUARD: Check if user has permission for the current path
  // Admin users completely bypass all route guard checks
  // Only block access if we find a matching nav item AND the user doesn't have permission
  // If no nav item is found, let the feature page handle it (it will show "Page Not Found")
  // This ensures all users can access modules they have permission for
  
  // Debug: Log route guard check
  useEffect(() => {
    if (pathname && isAuthenticated && user && mounted) {
      console.log('[RouteGuard] Checking access:', {
        pathname,
        role,
        userRole: user?.role,
        isAdminUser,
        willBypassGuard: isAdminUser
      })
    }
  }, [pathname, isAuthenticated, user, mounted, role, isAdminUser])

  // Completely skip route guard for admin users
  if (pathname && isAuthenticated && user && mounted && !isAdminUser) {
    // Skip route guard entirely for admin users - they have access to everything
    const pathParts = pathname.split('/')
    // pathParts: ["", "dashboard", "role", "feature", ...]
    const currentFeature = pathParts[3] // e.g., "inventory", "prescriptions", "billing"

    // Only check permissions for feature routes (not dashboard root)
    if (currentFeature) {
      // Find the navigation item that matches this feature
      const navItem = navigationItems.find(item => {
        // Handle special mappings for lab routes
        if (item.id === "lab-dashboard") return currentFeature === "lab" && !pathParts[4]
        if (item.id === "lab-queue") return currentFeature === "lab" && pathParts[4] === "queue"
        if (item.id === "lab-results") return currentFeature === "lab" && pathParts[4] === "results"
        // Standard matching
        return item.id === currentFeature
      })

      // Only check permissions if we found a matching nav item in the navigation
      // This ensures we're checking permissions for known routes
      if (navItem) {
        const hasPermission = navItem.permissions.includes("all") ||
          navItem.permissions.some(p => activePermissions.includes(p))

        if (!hasPermission) {
          // User is trying to access a route they don't have permission for
          console.warn('[RouteGuard] Access denied:', {
            user: user.id,
            role: user.role,
            feature: currentFeature,
            requiredPermissions: navItem.permissions,
            userPermissions: activePermissions
          })
          return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
              <div className="max-w-md w-full text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-destructive" />
                </div>
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-muted-foreground">
                  You do not have permission to access the <strong>{navItem.label}</strong> module.
                  This incident may be logged.
                </p>
                <Button onClick={() => router.push(`/dashboard/${role}`)} variant="default">
                  Return to Dashboard
                </Button>
              </div>
            </div>
          )
        }
      }
      // If no nav item found, continue - let the feature page handle routing
      // This allows access to routes that exist in featureComponents but aren't in navigation
    }
  } else if (pathname && isAuthenticated && user && mounted && isAdminUser) {
    // Admin user - log that we're bypassing the guard
    console.log('[RouteGuard] Admin user - bypassing route guard for:', pathname)
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
              activeItem={activeItem}
              onClose={() => setSidebarOpen(false)}
              handleLogout={handleLogout}
              filteredNavigation={filteredNavigation}
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
              <NotificationCenter className="hidden sm:block" />
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
  onClose?: () => void
  handleLogout: () => void
}

function SidebarContent({
  role,
  currentRole,
  RoleIcon,
  filteredNavigation,
  activeItem,
  onClose,
  handleLogout,
}: SidebarContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useTranslation()
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['core', 'patients'])) // Default expanded categories
  const navRef = useRef<HTMLElement>(null)
  const scrollPositionRef = useRef<number>(0)
  const STORAGE_KEY = 'sidebar-scroll-position'

  // Save scroll position to sessionStorage
  const saveScrollPosition = () => {
    const navElement = navRef.current
    if (navElement) {
      const scrollTop = navElement.scrollTop
      scrollPositionRef.current = scrollTop
      try {
        sessionStorage.setItem(STORAGE_KEY, scrollTop.toString())
      } catch (e) {
        // Ignore storage errors
      }
    }
  }

  // Restore scroll position from sessionStorage
  const restoreScrollPosition = () => {
    const navElement = navRef.current
    if (!navElement) return

    try {
      const savedPosition = sessionStorage.getItem(STORAGE_KEY)
      if (savedPosition) {
        const position = parseInt(savedPosition, 10)
        scrollPositionRef.current = position
        // Use multiple attempts to ensure scroll is restored
        requestAnimationFrame(() => {
          if (navElement) {
            navElement.scrollTop = position
            // Double-check after a small delay
            setTimeout(() => {
              if (navElement && navElement.scrollTop !== position) {
                navElement.scrollTop = position
              }
            }, 100)
          }
        })
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  // Auto-expand category containing the active item
  // This ensures the category stays open when navigating to items within it
  useEffect(() => {
    if (activeItem) {
      // Find which category contains the active item from the full navigationItems array
      const activeNavItem = navigationItems.find(item => item.id === activeItem)
      const activeCategory = activeNavItem?.category
      
      if (activeCategory) {
        setExpandedCategories(prev => {
          // Always ensure the active category is expanded
          // This prevents the category from collapsing when clicking on items within it
          if (!prev.has(activeCategory)) {
            const newSet = new Set(prev)
            newSet.add(activeCategory)
            return newSet
          }
          // Category is already expanded, keep it expanded
          return prev
        })
      }
    }
  }, [activeItem, pathname]) // Removed filteredNavigation from deps since we use navigationItems directly

  // Prevent category collapse when clicking on navigation items within that category
  // This ensures categories stay open when navigating between items in the same group
  const handleCategoryToggle = (category: string, e?: React.MouseEvent) => {
    // Prevent toggle if this category contains the active item
    const activeNavItem = navigationItems.find(item => item.id === activeItem)
    const activeCategory = activeNavItem?.category
    
    // Don't allow collapsing the category that contains the active item
    if (category === activeCategory && expandedCategories.has(category)) {
      e?.preventDefault()
      e?.stopPropagation()
      return
    }
    
    toggleCategory(category)
  }

  // Continuously save scroll position as user scrolls
  useEffect(() => {
    const navElement = navRef.current
    if (!navElement) return

    const handleScroll = () => {
      scrollPositionRef.current = navElement.scrollTop
      try {
        sessionStorage.setItem(STORAGE_KEY, navElement.scrollTop.toString())
      } catch (e) {
        // Ignore storage errors
      }
    }

    navElement.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      navElement.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Restore scroll position after route changes
  useEffect(() => {
    // Wait for DOM to be ready and categories to expand
    const timeoutId = setTimeout(() => {
      restoreScrollPosition()
    }, 150)

    return () => {
      clearTimeout(timeoutId)
      // Save scroll position before route change
      saveScrollPosition()
    }
  }, [activeItem, pathname])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      
      // Find the active category to prevent collapsing it
      const activeNavItem = navigationItems.find(item => item.id === activeItem)
      const activeCategory = activeNavItem?.category
      
      // Prevent collapsing the category that contains the active item
      if (category === activeCategory && newSet.has(category)) {
        // Don't allow collapsing the active category
        return prev
      }
      
      // Toggle the category
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sidebar header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border shrink-0">
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
      <div className="p-4 border-b border-sidebar-border shrink-0">
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

      {/* Navigation - Organized by Categories */}
      <nav ref={navRef} className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-4">
        {Object.entries(
          filteredNavigation.reduce<Record<string, typeof filteredNavigation>>((acc, item) => {
            const category = (item as any).category || 'other'
            if (!acc[category]) {
              acc[category] = []
            }
            acc[category].push(item)
            return acc
          }, {})
        )
          .filter(([_, items]) => items.length > 0) // Only show categories with items
          .sort(([a], [b]) => {
            // Sort categories in a logical order
            const order = ['core', 'patients', 'clinical', 'pharmacy', 'billing', 'inventory', 'catalog', 'reports', 'admin', 'other']
            return (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b))
          })
          .map(([category, items]) => {
            const isExpanded = expandedCategories.has(category)
            return (
              <div key={category} className="space-y-1">
                {/* Category Header - Collapsible */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full px-2 sm:px-3 py-1.5 border-b border-sidebar-border/50 flex items-center justify-between hover:bg-sidebar-accent/50 rounded-t-md transition-colors"
                >
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {categoryLabels[category] || category}
                  </h3>
                  <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Category Items - Collapsible */}
                {isExpanded && (
                  <div className="space-y-0.5 sm:space-y-1 pt-1 pb-1">
                    {items.map((item) => {
                      const Icon = item.icon
                      const isActive = activeItem === item.id

                      // Handle special route mappings
                      let routePath = item.id
                      if (item.id === "dashboard") {
                        routePath = ""
                      } else if (item.id === "lab-dashboard") {
                        routePath = "lab"
                      } else if (item.id === "lab-queue") {
                        routePath = "lab/queue"
                      } else if (item.id === "lab-results") {
                        routePath = "lab/results"
                      }

                      const targetPath = routePath === ""
                        ? `/dashboard/${role}`
                        : `/dashboard/${role}/${routePath}`

                      return (
                        <Link
                          key={item.id}
                          href={targetPath}
                          scroll={false}
                          onClick={(e) => {
                            // Prevent accordion toggle from parent category button
                            e.stopPropagation()
                            // Save scroll position before navigation
                            saveScrollPosition()
                            // Only close sidebar on mobile (when onClose is provided)
                            // This prevents desktop sidebar from closing when clicking grouped items
                            if (onClose) {
                              onClose()
                            }
                            // Debug: Log navigation (remove in production)
                            console.log('[Navigation] Navigating to:', targetPath, 'Item:', item.id)
                          }}
                          className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors w-full text-left ${isActive
                            ? 'bg-secondary text-secondary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                            }`}
                        >
                          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{item.labelKey ? t(item.labelKey) : item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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
