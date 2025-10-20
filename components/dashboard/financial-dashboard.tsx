'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  FileText, 
  CreditCard,
  PieChart,
  BarChart3,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react'
import { financialAPI } from '@/lib/api-client'
import { toast } from 'sonner'

interface FinancialSummary {
  period_start: string
  period_end: string
  total_revenue: number
  total_expenses: number
  net_profit: number
  total_invoices: number
  paid_invoices: number
  pending_invoices: number
  total_patients: number
  total_consultations: number
  total_prescriptions: number
  revenue_by_service: ServiceRevenue[]
  revenue_by_month: MonthlyRevenue[]
}

interface ServiceRevenue {
  service_name: string
  service_code: string
  total_revenue: number
  total_count: number
  average_price: number
}

interface MonthlyRevenue {
  month: string
  year: number
  total_revenue: number
  total_invoices: number
  total_patients: number
}

interface ProfitLossReport {
  period_start: string
  period_end: string
  revenue: RevenueBreakdown
  expenses: ExpenseBreakdown
  net_profit: number
  profit_margin: number
}

interface RevenueBreakdown {
  consultation_fees: number
  pharmacy_sales: number
  lab_tests: number
  other_services: number
  total: number
}

interface ExpenseBreakdown {
  staff_salaries: number
  medical_supplies: number
  equipment_maintenance: number
  utilities: number
  other_expenses: number
  total: number
}

interface FinancialKPIs {
  revenue_kpis: {
    total_revenue: number
    monthly_revenue: number
    daily_average: number
    revenue_growth: number
  }
  profit_kpis: {
    net_profit: number
    profit_margin: number
    gross_profit: number
    operating_profit: number
  }
  efficiency_kpis: {
    revenue_per_patient: number
    revenue_per_consultation: number
    collection_rate: number
    average_invoice_value: number
  }
  cash_flow_kpis: {
    cash_inflow: number
    cash_outflow: number
    net_cash_flow: number
    cash_reserves: number
  }
}

export default function FinancialDashboard() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [profitLoss, setProfitLoss] = useState<ProfitLossReport | null>(null)
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null)
  const [revenueAnalytics, setRevenueAnalytics] = useState<any>(null)
  const [expenseReport, setExpenseReport] = useState<any[]>([])
  
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  const [selectedPeriod, setSelectedPeriod] = useState('30d')

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const loadFinancialData = async () => {
    setLoading(true)
    try {
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      }

      const [summaryData, profitLossData, kpisData, analyticsData, expenseData] = await Promise.all([
        financialAPI.getSummary(params),
        financialAPI.getProfitLoss(params),
        financialAPI.getKPIs(),
        financialAPI.getRevenueAnalytics(params),
        financialAPI.getExpenseReport(params)
      ])

      setSummary(summaryData.data)
      setProfitLoss(profitLossData.data)
      setKpis(kpisData.data)
      setRevenueAnalytics(analyticsData.data)
      setExpenseReport(expenseData.data)
    } catch (error) {
      console.error('Error loading financial data:', error)
      toast.error('Failed to load financial data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFinancialData()
  }, [dateRange])

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    const now = new Date()
    let startDate: Date

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }

    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0]
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading financial data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive financial overview and analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadFinancialData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="start-date">From</Label>
              <Input
                id="start-date"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-40"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="end-date">To</Label>
              <Input
                id="end-date"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-40"
              />
            </div>
            <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.total_revenue)}</div>
              <p className="text-xs text-muted-foreground">
                {summary.total_invoices} invoices
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.net_profit)}</div>
              <p className="text-xs text-muted-foreground">
                {summary.total_expenses > 0 ? formatPercentage((summary.net_profit / summary.total_revenue) * 100) : '0%'} margin
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total_patients}</div>
              <p className="text-xs text-muted-foreground">
                {summary.total_consultations} consultations
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.total_invoices > 0 ? formatPercentage((summary.paid_invoices / summary.total_invoices) * 100) : '0%'}
              </div>
              <p className="text-xs text-muted-foreground">
                {summary.paid_invoices} of {summary.total_invoices} paid
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue by Service */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="h-5 w-5 mr-2" />
                  Revenue by Service
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary?.revenue_by_service.map((service, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{service.service_name}</p>
                      <p className="text-sm text-muted-foreground">{service.total_count} services</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(service.total_revenue)}</p>
                      <p className="text-sm text-muted-foreground">
                        {summary.total_revenue > 0 ? formatPercentage((service.total_revenue / summary.total_revenue) * 100) : '0%'}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Monthly Revenue Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Monthly Revenue Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary?.revenue_by_month.map((month, index) => (
                  <div key={index} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">{month.month} {month.year}</p>
                      <p className="text-sm text-muted-foreground">{month.total_patients} patients</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(month.total_revenue)}</p>
                      <p className="text-sm text-muted-foreground">{month.total_invoices} invoices</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Profit & Loss Tab */}
        <TabsContent value="profit-loss" className="space-y-4">
          {profitLoss && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Revenue Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Consultation Fees</span>
                    <span className="font-medium">{formatCurrency(profitLoss.revenue.consultation_fees)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pharmacy Sales</span>
                    <span className="font-medium">{formatCurrency(profitLoss.revenue.pharmacy_sales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lab Tests</span>
                    <span className="font-medium">{formatCurrency(profitLoss.revenue.lab_tests)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Other Services</span>
                    <span className="font-medium">{formatCurrency(profitLoss.revenue.other_services)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total Revenue</span>
                    <span>{formatCurrency(profitLoss.revenue.total)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Expense Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Expense Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Staff Salaries</span>
                    <span className="font-medium">{formatCurrency(profitLoss.expenses.staff_salaries)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Medical Supplies</span>
                    <span className="font-medium">{formatCurrency(profitLoss.expenses.medical_supplies)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Equipment Maintenance</span>
                    <span className="font-medium">{formatCurrency(profitLoss.expenses.equipment_maintenance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Utilities</span>
                    <span className="font-medium">{formatCurrency(profitLoss.expenses.utilities)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Other Expenses</span>
                    <span className="font-medium">{formatCurrency(profitLoss.expenses.other_expenses)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-bold">
                    <span>Total Expenses</span>
                    <span>{formatCurrency(profitLoss.expenses.total)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Net Profit Summary */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Net Profit Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{formatCurrency(profitLoss.net_profit)}</p>
                      <p className="text-muted-foreground">Net Profit</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={profitLoss.profit_margin >= 0 ? "default" : "destructive"} className="text-lg px-3 py-1">
                        {formatPercentage(profitLoss.profit_margin)} Margin
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Revenue Analytics Tab */}
        <TabsContent value="revenue" className="space-y-4">
          {revenueAnalytics && (
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(revenueAnalytics.total_revenue)}</div>
                    <p className="text-sm text-muted-foreground">
                      {formatPercentage(revenueAnalytics.revenue_growth)} growth
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Daily Average</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(revenueAnalytics.average_daily_revenue)}</div>
                    <p className="text-sm text-muted-foreground">Per day</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Top Service</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">{revenueAnalytics.top_services[0]?.service_name}</div>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(revenueAnalytics.top_services[0]?.revenue)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Top Services */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Services by Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {revenueAnalytics.top_services.map((service: any, index: number) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium">{service.service_name}</p>
                            <p className="text-sm text-muted-foreground">{formatPercentage(service.percentage)} of total</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatCurrency(service.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Expense Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expenseReport.map((expense, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{expense.category}</p>
                      <p className="text-sm text-muted-foreground">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">{expense.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(expense.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* KPIs Tab */}
        <TabsContent value="kpis" className="space-y-4">
          {kpis && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Revenue KPIs */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue KPIs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Revenue</span>
                    <span className="font-medium">{formatCurrency(kpis.revenue_kpis.total_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Monthly Revenue</span>
                    <span className="font-medium">{formatCurrency(kpis.revenue_kpis.monthly_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Daily Average</span>
                    <span className="font-medium">{formatCurrency(kpis.revenue_kpis.daily_average)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Growth Rate</span>
                    <Badge variant={kpis.revenue_kpis.revenue_growth >= 0 ? "default" : "destructive"}>
                      {formatPercentage(kpis.revenue_kpis.revenue_growth)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Profit KPIs */}
              <Card>
                <CardHeader>
                  <CardTitle>Profit KPIs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Net Profit</span>
                    <span className="font-medium">{formatCurrency(kpis.profit_kpis.net_profit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Profit Margin</span>
                    <Badge variant={kpis.profit_kpis.profit_margin >= 0 ? "default" : "destructive"}>
                      {formatPercentage(kpis.profit_kpis.profit_margin)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Gross Profit</span>
                    <span className="font-medium">{formatCurrency(kpis.profit_kpis.gross_profit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Operating Profit</span>
                    <span className="font-medium">{formatCurrency(kpis.profit_kpis.operating_profit)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Efficiency KPIs */}
              <Card>
                <CardHeader>
                  <CardTitle>Efficiency KPIs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Revenue per Patient</span>
                    <span className="font-medium">{formatCurrency(kpis.efficiency_kpis.revenue_per_patient)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Revenue per Consultation</span>
                    <span className="font-medium">{formatCurrency(kpis.efficiency_kpis.revenue_per_consultation)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Collection Rate</span>
                    <Badge variant={kpis.efficiency_kpis.collection_rate >= 90 ? "default" : "secondary"}>
                      {formatPercentage(kpis.efficiency_kpis.collection_rate)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Invoice Value</span>
                    <span className="font-medium">{formatCurrency(kpis.efficiency_kpis.average_invoice_value)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Cash Flow KPIs */}
              <Card>
                <CardHeader>
                  <CardTitle>Cash Flow KPIs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Cash Inflow</span>
                    <span className="font-medium text-green-600">{formatCurrency(kpis.cash_flow_kpis.cash_inflow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Outflow</span>
                    <span className="font-medium text-red-600">{formatCurrency(kpis.cash_flow_kpis.cash_outflow)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net Cash Flow</span>
                    <Badge variant={kpis.cash_flow_kpis.net_cash_flow >= 0 ? "default" : "destructive"}>
                      {formatCurrency(kpis.cash_flow_kpis.net_cash_flow)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Cash Reserves</span>
                    <span className="font-medium">{formatCurrency(kpis.cash_flow_kpis.cash_reserves)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
