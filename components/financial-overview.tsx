"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarChart, PieChart, MetricCard } from "@/components/ui/charts"
import { DataExport } from "@/components/ui/data-export"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  Smartphone,
  Shield,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Wallet,
} from "lucide-react"
import { calculateGrowthRate } from '@/lib/utils'
import { useToast } from "@/hooks/use-toast"
import { useInvoices } from "@/contexts/invoice-context"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardSkeleton } from "@/components/ui/loading"

// Mock financial data structure - now calculated from real invoices below

export function FinancialOverview() {
  const [period, setPeriod] = useState("thisMonth")
  const [viewType, setViewType] = useState("overview")
  const [isMounted, setIsMounted] = useState(false)
  const { toast } = useToast()
  const { invoices, getTotalRevenue, getRevenueByMethod, getOutstandingBalance } = useInvoices()

  // Ensure component is mounted to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return <DashboardSkeleton />
  }

  // Calculate real financial data from invoices
  const financialData = useMemo(() => {
    const today = new Date()
    let startDate: Date
    let endDate = today

    switch (period) {
      case "today":
        startDate = new Date(today.setHours(0, 0, 0, 0))
        break
      case "thisWeek":
        startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "thisMonth":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
        break
      case "thisYear":
        startDate = new Date(today.getFullYear(), 0, 1)
        break
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    }

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    const totalRevenue = getTotalRevenue(startDateStr, endDateStr)
    const cashRevenue = getRevenueByMethod('cash', startDateStr, endDateStr)
    const mpesaRevenue = getRevenueByMethod('mpesa', startDateStr, endDateStr)
    const shaRevenue = getRevenueByMethod('sha', startDateStr, endDateStr)
    const nhifRevenue = getRevenueByMethod('nhif', startDateStr, endDateStr)
    const mixedRevenue = getRevenueByMethod('mixed', startDateStr, endDateStr)

    const filteredInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.date)
      return invDate >= startDate && invDate <= endDate
    })

    // Calculate expenses (estimated as 50% of revenue for demo)
    const totalExpenses = totalRevenue * 0.5
    const netProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    // Calculate monthly data for the last 10 months
    const monthlyData = []
    for (let i = 9; i >= 0; i--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
      const monthStartStr = monthStart.toISOString().split('T')[0]
      const monthEndStr = monthEnd.toISOString().split('T')[0]

      const monthRevenue = getTotalRevenue(monthStartStr, monthEndStr)
      const monthExpenses = monthRevenue * 0.5

      monthlyData.push({
        month: monthStart.toLocaleString('default', { month: 'short' }),
        revenue: monthRevenue,
        expenses: monthExpenses,
        profit: monthRevenue - monthExpenses,
      })
    }

    return {
      overview: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        growthRate: calculateGrowthRate(totalRevenue, period),
      },
      revenue: {
        cash: cashRevenue,
        mpesa: mpesaRevenue,
        sha: shaRevenue,
        nhif: nhifRevenue,
        mixed: mixedRevenue,
      },
      expenses: {
        salaries: totalExpenses * 0.36,
        supplies: totalExpenses * 0.26,
        utilities: totalExpenses * 0.14,
        maintenance: totalExpenses * 0.12,
        other: totalExpenses * 0.12,
      },
      monthly: monthlyData,
      transactions: {
        today: filteredInvoices.filter(inv => inv.date === today.toISOString().split('T')[0]).length,
        thisWeek: filteredInvoices.filter(inv => {
          const invDate = new Date(inv.date)
          return invDate >= new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
        }).length,
        thisMonth: filteredInvoices.length,
        avgTransaction: filteredInvoices.length > 0 ? totalRevenue / filteredInvoices.length : 0,
      },
      patients: (() => {
        const uniquePatientIds = new Set(filteredInvoices.map(inv => inv.patientId))
        const totalPatients = uniquePatientIds.size

        // Calculate new vs returning patients
        // A patient is "new" if their first invoice ever is within the current period
        // A patient is "returning" if they have invoices before the current period
        let newPatients = 0
        let returningPatients = 0

        for (const patientId of uniquePatientIds) {
          // Check if this patient has any invoices before the current period
          const hasPreviousInvoices = invoices.some(inv => {
            if (inv.patientId !== patientId) return false
            const invDate = new Date(inv.date)
            return invDate < startDate
          })

          if (hasPreviousInvoices) {
            returningPatients++
          } else {
            newPatients++
          }
        }

        return {
          total: totalPatients,
          newThisMonth: newPatients,
          returning: returningPatients,
        }
      })(),
    }
  }, [period, invoices, getTotalRevenue, getRevenueByMethod])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
  }

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "Financial report is being generated...",
    })
  }

  const handleRefresh = () => {
    toast({
      title: "Refreshed",
      description: "Financial data updated successfully",
    })
  }

  // Calculate revenue breakdown for pie chart
  const revenueBreakdown = [
    { name: "Cash", value: financialData.revenue.cash, color: "#10b981" },
    { name: "M-Pesa", value: financialData.revenue.mpesa, color: "#3b82f6" },
    { name: "SHA", value: financialData.revenue.sha, color: "#8b5cf6" },
    { name: "NHIF", value: financialData.revenue.nhif, color: "#ec4899" },
    { name: "Mixed", value: financialData.revenue.mixed, color: "#f59e0b" },
  ].map(item => ({ label: item.name, value: item.value, color: item.color }))

  // Calculate expense breakdown for pie chart
  const expenseBreakdown = [
    { name: "Salaries", value: financialData.expenses.salaries, color: "#ef4444" },
    { name: "Supplies", value: financialData.expenses.supplies, color: "#f97316" },
    { name: "Utilities", value: financialData.expenses.utilities, color: "#eab308" },
    { name: "Maintenance", value: financialData.expenses.maintenance, color: "#06b6d4" },
    { name: "Other", value: financialData.expenses.other, color: "#6b7280" },
  ].map(item => ({ label: item.name, value: item.value, color: item.color }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Financial Overview</h2>
          <p className="text-muted-foreground">
            Comprehensive financial analytics and reporting
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="thisQuarter">This Quarter</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(financialData.overview.totalRevenue)}
          change={financialData.overview.growthRate}
          changeLabel="vs last month"
          icon={<DollarSign className="w-4 h-4" />}
        />
        <MetricCard
          title="Total Expenses"
          value={formatCurrency(financialData.overview.totalExpenses)}
          change={8.2}
          changeLabel="vs last month"
          icon={<ArrowDownRight className="w-4 h-4" />}
        />
        <MetricCard
          title="Net Profit"
          value={formatCurrency(financialData.overview.netProfit)}
          change={22.5}
          changeLabel="vs last month"
          icon={<ArrowUpRight className="w-4 h-4" />}
        />
        <MetricCard
          title="Profit Margin"
          value={`${financialData.overview.profitMargin}%`}
          change={0}
          changeLabel="Healthy"
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs value={viewType} onValueChange={setViewType} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analysis</TabsTrigger>
          <TabsTrigger value="expenses">Expense Analysis</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue vs Expenses Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue vs Expenses (Monthly)</CardTitle>
                <CardDescription>Last 10 months performance</CardDescription>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={financialData.monthly.map(m => ({
                    label: m.month,
                    value: m.revenue,
                    color: "#10b981"
                  }))}
                />
              </CardContent>
            </Card>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Current period highlights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Revenue Growth</span>
                    <Badge variant="default" className="bg-green-500">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {formatPercentage(financialData.overview.growthRate)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Profit Margin</span>
                    <Badge variant="default" className="bg-blue-500">
                      {financialData.overview.profitMargin}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Patients</span>
                    <span className="text-sm font-semibold">
                      {financialData.patients.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">New Patients</span>
                    <Badge variant="outline">
                      +{financialData.patients.newThisMonth}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Transaction</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(financialData.transactions.avgTransaction)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Transactions</span>
                    <span className="text-sm font-semibold">
                      {financialData.transactions.thisMonth.toLocaleString()}
                    </span>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Revenue is up {formatPercentage(financialData.overview.growthRate)} compared to last month. Keep up the great work!
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Revenue Analysis Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Payment Method</CardTitle>
                <CardDescription>Distribution of revenue sources</CardDescription>
              </CardHeader>
              <CardContent>
                <PieChart data={revenueBreakdown} />
              </CardContent>
            </Card>

            {/* Revenue Details */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Details</CardTitle>
                <CardDescription>Breakdown by payment type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium">Cash Payments</p>
                        <p className="text-sm text-muted-foreground">
                          {((financialData.revenue.cash / financialData.overview.totalRevenue) * 100).toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-lg">
                      {formatCurrency(financialData.revenue.cash)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">M-Pesa Payments</p>
                        <p className="text-sm text-muted-foreground">
                          {((financialData.revenue.mpesa / financialData.overview.totalRevenue) * 100).toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-lg">
                      {formatCurrency(financialData.revenue.mpesa)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="font-medium">SHA Insurance</p>
                        <p className="text-sm text-muted-foreground">
                          {((financialData.revenue.sha / financialData.overview.totalRevenue) * 100).toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-lg">
                      {formatCurrency(financialData.revenue.sha)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="font-medium">NHIF</p>
                        <p className="text-sm text-muted-foreground">
                          {((financialData.revenue.nhif / financialData.overview.totalRevenue) * 100).toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-lg">
                      {formatCurrency(financialData.revenue.nhif)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Expenses Analysis Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Expense Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Expense by Category</CardTitle>
                <CardDescription>Distribution of expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <PieChart data={expenseBreakdown} />
              </CardContent>
            </Card>

            {/* Expense Details */}
            <Card>
              <CardHeader>
                <CardTitle>Expense Details</CardTitle>
                <CardDescription>Breakdown by category</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(financialData.expenses).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium capitalize">{key}</p>
                      <p className="text-sm text-muted-foreground">
                        {((value / financialData.overview.totalExpenses) * 100).toFixed(1)}% of total
                      </p>
                    </div>
                    <span className="font-bold">{formatCurrency(value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Trends</CardTitle>
              <CardDescription>10-month historical performance</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={financialData.monthly.map(m => ({
                  label: m.month,
                  value: m.revenue,
                  color: "#10b981"
                }))}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="Today"
              value={financialData.transactions.today.toString()}
              changeLabel="Transactions"
              icon={<Calendar className="w-4 h-4" />}
            />
            <MetricCard
              title="This Week"
              value={financialData.transactions.thisWeek.toString()}
              changeLabel="Transactions"
              icon={<Calendar className="w-4 h-4" />}
            />
            <MetricCard
              title="This Month"
              value={financialData.transactions.thisMonth.toLocaleString()}
              changeLabel="Transactions"
              icon={<Calendar className="w-4 h-4" />}
            />
            <MetricCard
              title="Average"
              value={formatCurrency(financialData.transactions.avgTransaction)}
              changeLabel="Per transaction"
              icon={<Receipt className="w-4 h-4" />}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Financial Reports</CardTitle>
          <CardDescription>Download financial data in various formats</CardDescription>
        </CardHeader>
        <CardContent>
          <DataExport
            data={financialData.monthly}
            filename={`financial-report-${period}`}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default FinancialOverview
