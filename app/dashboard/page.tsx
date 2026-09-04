"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout-new"
import { StatCard } from "@/components/widgets/stat-card"
import { ScheduleWidget } from "@/components/widgets/schedule-widget"
import { QuickActionsWidget } from "@/components/widgets/quick-actions-widget"
import { RecentPatientsWidget } from "@/components/widgets/recent-patients-widget"
import { NotificationsWidget } from "@/components/widgets/notifications-widget"
import {
  Users,
  Calendar,
  Stethoscope,
  CreditCard,
  Pill,
  TestTube,
  TrendingUp,
  Clock,
} from "lucide-react"

interface DashboardStats {
  totalPatients: number
  todayAppointments: number
  pendingAppointments: number
  todayConsultations: number
  pendingLabOrders: number
  lowStockMedicines: number
  pendingInvoices: number
  todayRevenue: number
  weekRevenue: number
  monthRevenue: number
  recentPatients: Array<{
    id: string
    patientNumber: string
    firstName: string
    lastName: string
    phone: string
    createdAt: string
  }>
  recentNotifications: Array<{
    id: string
    subject: string
    content: string
    priority: string
    createdAt: string
  }>
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/")
    }
  }, [status, router])

  useEffect(() => {
    if (session) {
      fetchDashboardStats()
    }
  }, [session])

  const fetchDashboardStats = async () => {
    try {
      const res = await fetch("/api/dashboard")
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (error) {
      console.error("Failed to fetch dashboard stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session) return null

  const role = session.user?.role || "receptionist"

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Patients"
            value={stats?.totalPatients || 0}
            change="+12% from last month"
            changeType="positive"
            icon={Users}
            iconColor="bg-blue-500"
          />
          <StatCard
            title="Today's Appointments"
            value={stats?.todayAppointments || 0}
            change={`${stats?.pendingAppointments || 0} pending`}
            changeType="neutral"
            icon={Calendar}
            iconColor="bg-green-500"
          />
          <StatCard
            title="Consultations"
            value={stats?.todayConsultations || 0}
            change="Today"
            changeType="neutral"
            icon={Stethoscope}
            iconColor="bg-indigo-500"
          />
          <StatCard
            title="Revenue"
            value={formatCurrency(stats?.todayRevenue || 0)}
            change={`${formatCurrency(stats?.weekRevenue || 0)} this week`}
            changeType="positive"
            icon={TrendingUp}
            iconColor="bg-emerald-500"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Lab Orders"
            value={stats?.pendingLabOrders || 0}
            icon={TestTube}
            iconColor="bg-orange-500"
          />
          <StatCard
            title="Low Stock Medicines"
            value={stats?.lowStockMedicines || 0}
            change={stats?.lowStockMedicines ? "Reorder needed" : "Stock OK"}
            changeType={stats?.lowStockMedicines ? "negative" : "positive"}
            icon={Pill}
            iconColor="bg-purple-500"
          />
          <StatCard
            title="Pending Invoices"
            value={stats?.pendingInvoices || 0}
            icon={CreditCard}
            iconColor="bg-yellow-500"
          />
          <StatCard
            title="Monthly Revenue"
            value={formatCurrency(stats?.monthRevenue || 0)}
            icon={Clock}
            iconColor="bg-teal-500"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Schedule & Actions */}
          <div className="lg:col-span-2 space-y-6">
            <ScheduleWidget appointments={[]} />
            <QuickActionsWidget />
          </div>

          {/* Right Column - Notifications & Recent */}
          <div className="space-y-6">
            <NotificationsWidget notifications={(stats?.recentNotifications || []) as Array<{ id: string; subject: string; content: string; priority: "low" | "normal" | "high" | "urgent"; createdAt: string }>} />
            <RecentPatientsWidget patients={stats?.recentPatients || []} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
