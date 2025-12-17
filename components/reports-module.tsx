"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataExport } from "@/components/ui/data-export"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SHAMonthlyReport } from "@/components/sha-monthly-report"
import { useInvoices } from "@/contexts/invoice-context"
import { usePatientEnhanced } from "@/contexts/patient-context-enhanced"
import { useInventory } from "@/contexts/inventory-context"
import { usePurchaseOrders } from "@/contexts/purchase-order-context"
import { useAuditLog } from "@/contexts/audit-log-context"
import { DateRangeFilter, type DateRange, isDateInRange } from "@/components/date-range-filter"
import { format } from "date-fns"
import {
  FileText,
  Shield,
  Download,
  Filter,
  Calendar,
  Users,
  Activity,
  DollarSign,
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Search,
  Printer,
  Send,
  Eye,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Package,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { shaClaimAPI } from "@/lib/api-client"
import { dashboardCache, getCacheKey, withCache } from '@/lib/dashboard-cache'
import { useDebounce } from '@/hooks/use-debounce'
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardSkeleton } from "@/components/ui/loading"

// Mock SHA claims data
const mockSHAClaims = [
  {
    id: "SHA-2024-001",
    patientName: "John Doe",
    patientId: "P001",
    memberNumber: "SHA-123456",
    dateOfService: "2024-10-01",
    diagnosis: "A09 - Diarrhoea and gastroenteritis",
    services: [
      { code: "OPD-001", name: "Consultation", amount: 500 },
      { code: "LAB-001", name: "Blood Test", amount: 800 },
    ],
    totalAmount: 1300,
    status: "pending",
    submittedDate: "2024-10-02",
    claimNumber: "CLM-001-2024",
  },
  {
    id: "SHA-2024-002",
    patientName: "Jane Smith",
    patientId: "P002",
    memberNumber: "SHA-789012",
    dateOfService: "2024-10-02",
    diagnosis: "J06.9 - Acute upper respiratory infection",
    services: [
      { code: "OPD-001", name: "Consultation", amount: 500 },
      { code: "PHARM-001", name: "Medication", amount: 1200 },
    ],
    totalAmount: 1700,
    status: "approved",
    submittedDate: "2024-10-03",
    approvedDate: "2024-10-05",
    claimNumber: "CLM-002-2024",
  },
  {
    id: "SHA-2024-003",
    patientName: "Peter Kamau",
    patientId: "P003",
    memberNumber: "SHA-345678",
    dateOfService: "2024-10-03",
    diagnosis: "I10 - Essential hypertension",
    services: [
      { code: "OPD-001", name: "Consultation", amount: 500 },
      { code: "LAB-002", name: "ECG", amount: 1500 },
      { code: "PHARM-002", name: "Antihypertensive drugs", amount: 2000 },
    ],
    totalAmount: 4000,
    status: "rejected",
    submittedDate: "2024-10-04",
    rejectedDate: "2024-10-06",
    rejectionReason: "Incomplete documentation",
    claimNumber: "CLM-003-2024",
  },
]

// Mock audit trail data
const mockAuditLog = [
  {
    id: "AUD-001",
    timestamp: "2024-10-02 09:15:23",
    user: "Dr. Sarah Smith",
    role: "Clinician",
    action: "Created Patient Record",
    entity: "Patient",
    entityId: "P001",
    details: "New patient registration: John Doe",
    ipAddress: "192.168.1.10",
    status: "success",
  },
  {
    id: "AUD-002",
    timestamp: "2024-10-02 09:30:45",
    user: "Nurse Mary",
    role: "Nurse",
    action: "Recorded Vitals",
    entity: "Visit",
    entityId: "V001",
    details: "BP: 120/80, Temp: 37.2°C, Weight: 70kg",
    ipAddress: "192.168.1.15",
    status: "success",
  },
  {
    id: "AUD-003",
    timestamp: "2024-10-02 10:00:12",
    user: "Admin User",
    role: "Administrator",
    action: "Failed Login Attempt",
    entity: "Authentication",
    entityId: "N/A",
    details: "Invalid credentials provided",
    ipAddress: "192.168.1.99",
    status: "failure",
  },
  {
    id: "AUD-004",
    timestamp: "2024-10-02 10:15:33",
    user: "John Receptionist",
    role: "Receptionist",
    action: "Generated Invoice",
    entity: "Invoice",
    entityId: "INV-001",
    details: "Invoice for Patient P001, Amount: KES 1,300",
    ipAddress: "192.168.1.20",
    status: "success",
  },
  {
    id: "AUD-005",
    timestamp: "2024-10-02 10:45:56",
    user: "Mary Pharmacist",
    role: "Pharmacist",
    action: "Dispensed Medication",
    entity: "Prescription",
    entityId: "RX-001",
    details: "Amoxicillin 500mg, Qty: 21 tablets",
    ipAddress: "192.168.1.25",
    status: "success",
  },
]

// Mock patient statistics
const mockPatientStats = {
  totalPatients: 1247,
  newPatients: 89,
  activePatients: 856,
  byGender: {
    male: 612,
    female: 635,
  },
  byAgeGroup: [
    { group: "0-18", count: 245 },
    { group: "19-35", count: 387 },
    { group: "36-50", count: 298 },
    { group: "51-65", count: 215 },
    { group: "66+", count: 102 },
  ],
  byInsurance: {
    sha: 456,
    nhif: 123,
    private: 89,
    cash: 579,
  },
}

export function ReportsModule() {
  const [reportType, setReportType] = useState("sha-monthly")
  const [dateRange, setDateRange] = useState("thisMonth")
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [customDateRange, setCustomDateRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [isMounted, setIsMounted] = useState(false)

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const { toast } = useToast()

  // Ensure component is mounted to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // IMPORTANT: All hooks must be called BEFORE any conditional returns
  // Context hooks for real data
  const { invoices, getTotalRevenue, getRevenueByMethod, getOutstandingBalance } = useInvoices()
  const { patients, getTotalPatients, getActivePatients } = usePatientEnhanced()
  const { medicines, getLowStockMedicines } = useInventory()
  const { purchaseOrders, getTotalOrdersValue, getPendingOrdersCount } = usePurchaseOrders()
  const { logs } = useAuditLog()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case "approved":
        return <Badge variant="default" className="bg-green-500">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      case "success":
        return <Badge variant="default" className="bg-green-500">Success</Badge>
      case "failure":
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleExportSHAClaims = () => {
    toast({
      title: "Export Started",
      description: "SHA claims report is being generated...",
    })
  }

  const handleSubmitClaim = (claimId: string) => {
    toast({
      title: "Claim Submitted",
      description: `SHA claim ${claimId} has been submitted for processing`,
    })
  }

  const handlePrintReport = () => {
    toast({
      title: "Printing",
      description: "Report is being prepared for printing...",
    })
    window.print()
  }

  // Real data calculations using useMemo
  // IMPORTANT: Handle unmounted state inside useMemo to prevent errors
  const realData = useMemo(() => {
    // Return empty data structure if not mounted to prevent errors
    if (!isMounted || !invoices || !patients || !medicines || !purchaseOrders || !logs) {
      return {
        totalRevenue: 0,
        revenueByMethod: 0,
        outstandingBalance: 0,
        totalPatients: 0,
        activePatients: 0,
        lowStockItems: [],
        expiringItems: [],
        totalOrdersValue: 0,
        pendingOrdersCount: 0,
        recentLogs: [],
        monthlyRevenue: 0,
        monthlyPatients: 0,
        filteredInvoices: [],
        filteredPatients: [],
        filteredPurchaseOrders: [],
      }
    }

    // Financial data
    const totalRevenue = getTotalRevenue()
    const revenueByMethod = getRevenueByMethod('cash') // Default to cash method
    const outstandingBalance = getOutstandingBalance()

    // Patient data
    const totalPatients = patients.length
    const activePatients = patients.length // All patients are considered active in the current system

    // Inventory data
    const lowStockItems = getLowStockMedicines()
    const expiringItems = medicines.filter(med => {
      if (!med.batches || med.batches.length === 0) return false
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      return med.batches.some(batch => {
        const expiryDate = new Date(batch.expiryDate)
        return expiryDate <= thirtyDaysFromNow
      })
    })

    // Purchase order data
    const totalOrdersValue = getTotalOrdersValue()
    const pendingOrdersCount = getPendingOrdersCount()

    // Audit log data
    const recentLogs = logs.slice(0, 50) // Last 50 logs

    // Calculate filtered data based on custom date range
    const filteredInvoices = invoices.filter(inv =>
      isDateInRange(inv.createdAt, customDateRange)
    )

    const filteredPatients = patients.filter(patient =>
      isDateInRange(patient.created_at, customDateRange)
    )

    const filteredLogs = logs.filter(log =>
      isDateInRange(log.timestamp, customDateRange)
    )

    const filteredPurchaseOrders = purchaseOrders.filter(po =>
      isDateInRange(po.orderDate, customDateRange)
    )

    const monthlyRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0)
    const monthlyPatients = filteredPatients.length

    return {
      totalRevenue,
      revenueByMethod,
      outstandingBalance,
      totalPatients,
      activePatients,
      lowStockItems,
      expiringItems,
      totalOrdersValue,
      pendingOrdersCount,
      recentLogs: filteredLogs.slice(0, 50), // Last 50 filtered logs
      monthlyRevenue,
      monthlyPatients,
      filteredInvoices,
      filteredPatients,
      filteredPurchaseOrders,
    }
  }, [invoices, patients, medicines, purchaseOrders, logs, getTotalRevenue, getRevenueByMethod, getOutstandingBalance, getTotalOrdersValue, getPendingOrdersCount, getLowStockMedicines, customDateRange, isMounted])

  // Memoize filtered audit logs
  const filteredLogs = useMemo(() => {
    return realData.recentLogs.filter((log: any) => {
      const matchesSearch = !debouncedSearchQuery ||
        log.action.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        log.userName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        log.entityType.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      return matchesSearch
    })
  }, [realData.recentLogs, debouncedSearchQuery])

  // Calculate audit statistics
  const auditStats = {
    total: realData.recentLogs.length,
    today: realData.recentLogs.filter((log: any) => {
      const logDate = new Date(log.timestamp)
      const today = new Date()
      return logDate.toDateString() === today.toDateString()
    }).length,
    thisWeek: realData.recentLogs.filter((log: any) => {
      const logDate = new Date(log.timestamp)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return logDate >= weekAgo
    }).length,
  }

  // Fetch real SHA claims stats from API
  const [shaStats, setShaStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalAmount: 0,
    approvedAmount: 0,
  })
  const [filteredClaims, setFilteredClaims] = useState<any[]>([])
  const [shaClaimsLoading, setShaClaimsLoading] = useState(true)

  // Memoized cache key for SHA claims
  const shaClaimsCacheKey = useMemo(
    () => getCacheKey('sha-claims', {
      dateFrom: customDateRange.from?.toISOString(),
      dateTo: customDateRange.to?.toISOString()
    }),
    [customDateRange.from, customDateRange.to]
  )

  useEffect(() => {
    const fetchSHAClaims = async () => {
      try {
        setShaClaimsLoading(true)
        const dateFrom = customDateRange.from ? format(customDateRange.from, 'yyyy-MM-dd') : undefined
        const dateTo = customDateRange.to ? format(customDateRange.to, 'yyyy-MM-dd') : undefined

        const claims = await withCache(
          shaClaimsCacheKey,
          () => shaClaimAPI.getAll(),
          5 * 60 * 1000 // Cache for 5 minutes
        )

        if (claims && Array.isArray(claims)) {
          // Filter claims by date range if specified
          let filtered = claims
          if (dateFrom || dateTo) {
            filtered = claims.filter((claim: any) => {
              const claimDate = claim.claim_date || claim.submission_date || claim.created_at
              if (!claimDate) return false
              const claimDateStr = typeof claimDate === 'string' ? claimDate.split('T')[0] : claimDate

              if (dateFrom && claimDateStr < dateFrom) return false
              if (dateTo && claimDateStr > dateTo) return false
              return true
            })
          }

          setFilteredClaims(filtered)

          // Calculate stats
          const stats = {
            total: filtered.length,
            pending: filtered.filter((c: any) => c.status === 'pending' || c.status === 'submitted').length,
            approved: filtered.filter((c: any) => c.status === 'approved' || c.status === 'paid').length,
            rejected: filtered.filter((c: any) => c.status === 'rejected' || c.status === 'denied').length,
            totalAmount: filtered.reduce((sum: number, c: any) => sum + (parseFloat(c.total_amount || 0)), 0),
            approvedAmount: filtered
              .filter((c: any) => c.status === 'approved' || c.status === 'paid')
              .reduce((sum: number, c: any) => sum + (parseFloat(c.approved_amount || c.total_amount || 0)), 0),
          }
          setShaStats(stats)
        }
      } catch (error) {
        console.error("Error fetching SHA claims:", error)
        // Keep default stats on error
      } finally {
        setShaClaimsLoading(false)
      }
    }

    fetchSHAClaims()
  }, [shaClaimsCacheKey, customDateRange])

  // Conditional return AFTER all hooks are called
  if (!isMounted) {
    return <DashboardSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive reporting, SHA claims, and audit trails
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintReport}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExportSHAClaims}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <DateRangeFilter
          onDateRangeChange={setCustomDateRange}
          placeholder="Filter by date range"
          className="w-full sm:w-auto"
        />
        <div className="text-sm text-muted-foreground">
          Showing data for: {customDateRange.from || customDateRange.to ?
            `${customDateRange.from ? format(customDateRange.from, 'MMM dd') : 'Start'} - ${customDateRange.to ? format(customDateRange.to, 'MMM dd, yyyy') : 'End'} ` :
            'All time'
          }
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={reportType} onValueChange={setReportType} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sha-monthly">SHA Monthly Report</TabsTrigger>
          <TabsTrigger value="audit-trail">Audit Trail</TabsTrigger>
          <TabsTrigger value="patient-stats">Patient Statistics</TabsTrigger>
          <TabsTrigger value="financial">Financial Reports</TabsTrigger>
        </TabsList>

        {/* SHA Monthly Report Tab */}
        <TabsContent value="sha-monthly" className="space-y-4">
          <SHAMonthlyReport />
        </TabsContent>

        {/* SHA Claims Tab (Old - keeping for reference) */}
        <TabsContent value="sha-claims" className="space-y-4">
          {/* SHA Claims Statistics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{shaStats.total}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{shaStats.pending}</div>
                <p className="text-xs text-muted-foreground">Awaiting approval</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{shaStats.approved}</div>
                <p className="text-xs text-muted-foreground">{formatCurrency(shaStats.approvedAmount)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(shaStats.totalAmount)}</div>
                <p className="text-xs text-muted-foreground">All claims</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filter Claims</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="thisWeek">This Week</SelectItem>
                      <SelectItem value="thisMonth">This Month</SelectItem>
                      <SelectItem value="lastMonth">Last Month</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Patient, claim, member #"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Claims List */}
          <Card>
            <CardHeader>
              <CardTitle>SHA Claims ({filteredClaims.length})</CardTitle>
              <CardDescription>
                Review and manage SHA insurance claims
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredClaims.map((claim) => (
                  <div key={claim.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{claim.patientName}</h4>
                          {getStatusBadge(claim.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Member: {claim.memberNumber} | Claim: {claim.claimNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(claim.totalAmount)}</p>
                        <p className="text-sm text-muted-foreground">{claim.dateOfService}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm"><strong>Diagnosis:</strong> {claim.diagnosis}</p>
                      <div className="text-sm">
                        <strong>Services:</strong>
                        <ul className="ml-4 mt-1 space-y-1">
                          {claim.services.map((service: any, idx: number) => (
                            <li key={idx}>
                              {service.code} - {service.name}: {formatCurrency(service.amount)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {claim.status === "rejected" && claim.rejectionReason && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Rejection Reason:</strong> {claim.rejectionReason}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      {claim.status === "pending" && (
                        <Button size="sm" onClick={() => handleSubmitClaim(claim.claimNumber)}>
                          <Send className="h-4 w-4 mr-1" />
                          Submit to SHA
                        </Button>
                      )}
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit-trail" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Trail</CardTitle>
              <CardDescription>
                Comprehensive log of all system activities and user actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{log.action}</p>
                          <p className="text-sm text-muted-foreground">
                            by {log.userName} ({log.userRole})
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge('success')}
                        <p className="text-xs text-muted-foreground mt-1">
                          {log.timestamp}
                        </p>
                      </div>
                    </div>
                    <div className="ml-8 space-y-1 text-sm">
                      <p><strong>Entity:</strong> {log.entityType} ({log.entityId})</p>
                      <p><strong>Details:</strong> {log.details}</p>
                      <p className="text-muted-foreground">
                        <strong>IP:</strong> {log.ipAddress}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patient Statistics Tab */}
        <TabsContent value="patient-stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realData.totalPatients.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Patients</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realData.monthlyPatients}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
                <Activity className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realData.activePatients}</div>
                <p className="text-xs text-muted-foreground">Last 90 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(realData.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Age Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Patients by Age Group</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockPatientStats.byAgeGroup.map((group) => (
                    <div key={group.group} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{group.group} years</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(group.count / mockPatientStats.totalPatients) * 100}% `,
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{group.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Insurance Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Patients by Insurance Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(mockPatientStats.byInsurance).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">{type}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(count / mockPatientStats.totalPatients) * 100}% `,
                            }}
                          />
                        </div>
                        <span className="text-sm font-bold w-12 text-right">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Real Data Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realData.lowStockItems.length}</div>
                <p className="text-xs text-muted-foreground">Need reordering</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Expiring Items</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realData.expiringItems.length}</div>
                <p className="text-xs text-muted-foreground">Next 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{realData.pendingOrdersCount}</div>
                <p className="text-xs text-muted-foreground">Pending orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(realData.outstandingBalance)}</div>
                <p className="text-xs text-muted-foreground">Unpaid invoices</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Financial Reports Tab */}
        <TabsContent value="financial" className="space-y-4">
          <Alert>
            <BarChart3 className="h-4 w-4" />
            <AlertDescription>
              For comprehensive financial analytics, please visit the{" "}
              <Button variant="link" className="p-0 h-auto" onClick={() => window.location.href = '/dashboard/admin/financial-overview'}>
                Financial Overview
              </Button>{" "}
              module.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle>Export Reports</CardTitle>
          <CardDescription>Download reports in various formats</CardDescription>
        </CardHeader>
        <CardContent>
          <DataExport
            data={reportType === "audit-trail" ? filteredLogs : [realData]}
            filename={`${reportType} -report - ${Date.now()} `}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default ReportsModule
