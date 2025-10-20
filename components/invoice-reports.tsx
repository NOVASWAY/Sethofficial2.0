"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Download, 
  FileText, 
  DollarSign, 
  Shield, 
  Calendar,
  Printer,
  BarChart3,
  TrendingUp,
  Users
} from "lucide-react"

interface InvoiceReportProps {
  invoices: any[]
  role: string
}

interface ReportData {
  period: string
  totalInvoices: number
  totalRevenue: number
  cashRevenue: number
  mpesaRevenue: number
  shaRevenue: number
  paidInvoices: number
  pendingInvoices: number
  overdueInvoices: number
}

export function InvoiceReports({ invoices, role }: InvoiceReportProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("week")
  const [selectedReportType, setSelectedReportType] = useState("summary")
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const [reportCategory, setReportCategory] = useState<"all" | "sha" | "mpesa" | "cash">("all")

  const generateReportData = (period: string, category: string = "all"): ReportData => {
    const now = new Date()
    let startDate: Date

    switch (period) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case "quarter":
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    let filteredInvoices = invoices.filter(inv => new Date(inv.date) >= startDate)
    
    // Filter by category if not "all"
    if (category !== "all") {
      filteredInvoices = filteredInvoices.filter(inv => inv.type === category)
    }
    
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0)
    const cashRevenue = filteredInvoices
      .filter(inv => inv.type === "Cash")
      .reduce((sum, inv) => sum + inv.total, 0)
    const mpesaRevenue = filteredInvoices
      .filter(inv => inv.type === "M-Pesa")
      .reduce((sum, inv) => sum + inv.total, 0)
    const shaRevenue = filteredInvoices
      .filter(inv => inv.type === "SHA")
      .reduce((sum, inv) => sum + inv.total, 0)

    return {
      period: period === "week" ? "Weekly" : period === "month" ? "Monthly" : "Quarterly",
      totalInvoices: filteredInvoices.length,
      totalRevenue,
      cashRevenue,
      mpesaRevenue,
      shaRevenue,
      paidInvoices: filteredInvoices.filter(inv => inv.status === "Paid").length,
      pendingInvoices: filteredInvoices.filter(inv => inv.status === "Pending").length,
      overdueInvoices: filteredInvoices.filter(inv => inv.status === "Overdue").length,
    }
  }

  const reportData = generateReportData(selectedPeriod, reportCategory)

  const handleGenerateReport = () => {
    setIsReportDialogOpen(true)
  }

  const handlePrintReport = () => {
    window.print()
  }

  const canGenerateReports = role === "admin" || role === "receptionist" || role === "pharmacist"

  if (!canGenerateReports) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Invoice Reports & Analytics</span>
          </CardTitle>
          <CardDescription>Generate comprehensive invoice reports and printouts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Report Period</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Report Category</Label>
              <Select value={reportCategory} onValueChange={(value: "all" | "sha" | "mpesa" | "cash") => setReportCategory(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Invoices</SelectItem>
                  <SelectItem value="sha">SHA Claims Only</SelectItem>
                  <SelectItem value="mpesa">M-Pesa Only</SelectItem>
                  <SelectItem value="cash">Cash Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={selectedReportType} onValueChange={setSelectedReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary Report</SelectItem>
                  <SelectItem value="detailed">Detailed Report</SelectItem>
                  <SelectItem value="payment-methods">Payment Methods</SelectItem>
                  <SelectItem value="sha-claims">SHA Claims</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end space-x-2">
              <Button onClick={handleGenerateReport} className="flex-1">
                <FileText className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
              <Button variant="outline" onClick={handlePrintReport}>
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Total Invoices</p>
                <p className="text-2xl font-bold">{reportData.totalInvoices}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Total Revenue</p>
                <p className="text-2xl font-bold">KSh {reportData.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">M-Pesa Revenue</p>
                <p className="text-2xl font-bold">KSh {reportData.mpesaRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-accent" />
              <div>
                <p className="text-sm font-medium">SHA Claims</p>
                <p className="text-2xl font-bold">KSh {reportData.shaRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods Breakdown</CardTitle>
          <CardDescription>{reportData.period} revenue by payment method</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Cash Payments</span>
                <Badge variant="outline">Cash</Badge>
              </div>
              <p className="text-2xl font-bold">KSh {reportData.cashRevenue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">
                {reportData.totalRevenue > 0 ? ((reportData.cashRevenue / reportData.totalRevenue) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">M-Pesa Payments</span>
                <Badge variant="outline">M-Pesa</Badge>
              </div>
              <p className="text-2xl font-bold">KSh {reportData.mpesaRevenue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">
                {reportData.totalRevenue > 0 ? ((reportData.mpesaRevenue / reportData.totalRevenue) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">SHA Claims</span>
                <Badge variant="outline">SHA</Badge>
              </div>
              <p className="text-2xl font-bold">KSh {reportData.shaRevenue.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">
                {reportData.totalRevenue > 0 ? ((reportData.shaRevenue / reportData.totalRevenue) * 100).toFixed(1) : 0}% of total
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Status Summary</CardTitle>
          <CardDescription>Current status of all invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Paid Invoices</span>
                <Badge className="bg-green-500">Paid</Badge>
              </div>
              <p className="text-2xl font-bold">{reportData.paidInvoices}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Pending Invoices</span>
                <Badge className="bg-yellow-500">Pending</Badge>
              </div>
              <p className="text-2xl font-bold">{reportData.pendingInvoices}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Overdue Invoices</span>
                <Badge className="bg-red-500">Overdue</Badge>
              </div>
              <p className="text-2xl font-bold">{reportData.overdueInvoices}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reportData.period} Consolidated Invoice Report
              {reportCategory !== "all" && ` - ${reportCategory.toUpperCase()} Only`}
            </DialogTitle>
            <DialogDescription>
              Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              {reportCategory !== "all" && ` | Filtered by: ${reportCategory.toUpperCase()}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 print:space-y-4">
            {/* Report Header */}
            <div className="text-center border-b pb-4 print:border-b-2 print:pb-2">
              <h2 className="text-3xl font-bold print:text-2xl">Seth Medical Clinic</h2>
              <p className="text-lg text-muted-foreground print:text-base">
                Consolidated Invoice Report - {reportData.period}
                {reportCategory !== "all" && ` (${reportCategory.toUpperCase()} Only)`}
              </p>
              <p className="text-sm text-muted-foreground print:text-xs">
                Period: {selectedPeriod === "week" ? "Last 7 days" : selectedPeriod === "month" ? "This month" : "This quarter"}
              </p>
              <p className="text-sm text-muted-foreground print:text-xs">
                Report Date: {new Date().toLocaleDateString()}
              </p>
              {reportCategory !== "all" && (
                <p className="text-sm text-muted-foreground print:text-xs">
                  Filter: {reportCategory === "sha" ? "SHA Insurance Claims" : 
                          reportCategory === "mpesa" ? "M-Pesa Payments" : 
                          "Cash Payments"}
                </p>
              )}
            </div>

            {/* Executive Summary */}
            <div className="grid grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
              <div className="p-3 border rounded-lg print:p-2">
                <p className="text-sm font-medium print:text-xs">Total Patients</p>
                <p className="text-2xl font-bold print:text-lg">{new Set(invoices.map(inv => inv.patientId)).size}</p>
              </div>
              <div className="p-3 border rounded-lg print:p-2">
                <p className="text-sm font-medium print:text-xs">Total Invoices</p>
                <p className="text-2xl font-bold print:text-lg">{reportData.totalInvoices}</p>
              </div>
              <div className="p-3 border rounded-lg print:p-2">
                <p className="text-sm font-medium print:text-xs">Total Revenue</p>
                <p className="text-2xl font-bold print:text-lg">KSh {reportData.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="p-3 border rounded-lg print:p-2">
                <p className="text-sm font-medium print:text-xs">Average per Patient</p>
                <p className="text-2xl font-bold print:text-lg">
                  KSh {new Set(invoices.map(inv => inv.patientId)).size > 0 ? 
                    Math.round(reportData.totalRevenue / new Set(invoices.map(inv => inv.patientId)).size).toLocaleString() : 
                    '0'}
                </p>
              </div>
            </div>

            {/* Payment Methods Breakdown */}
            {reportCategory === "all" && (
              <div className="border rounded-lg p-4 print:p-2">
                <h3 className="text-lg font-semibold mb-3 print:text-base print:mb-2">Payment Methods Summary</h3>
                <div className="grid grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
                  <div className="text-center p-3 bg-green-50 rounded print:p-2">
                    <p className="text-sm font-medium print:text-xs">Cash Payments</p>
                    <p className="text-xl font-bold print:text-lg">{invoices.filter(inv => inv.type === "Cash").length}</p>
                    <p className="text-sm text-green-600 print:text-xs">KSh {reportData.cashRevenue.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded print:p-2">
                    <p className="text-sm font-medium print:text-xs">M-Pesa Payments</p>
                    <p className="text-xl font-bold print:text-lg">{invoices.filter(inv => inv.type === "M-Pesa").length}</p>
                    <p className="text-sm text-blue-600 print:text-xs">KSh {reportData.mpesaRevenue.toLocaleString()}</p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded print:p-2">
                    <p className="text-sm font-medium print:text-xs">SHA Claims</p>
                    <p className="text-xl font-bold print:text-lg">{invoices.filter(inv => inv.type === "SHA").length}</p>
                    <p className="text-sm text-purple-600 print:text-xs">KSh {reportData.shaRevenue.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Patient Invoice Details */}
            <div className="border rounded-lg p-4 print:p-2">
              <h3 className="text-lg font-semibold mb-3 print:text-base print:mb-2">Patient Invoice Details</h3>
              <div className="overflow-x-auto print:overflow-visible">
                <Table className="print:text-xs">
                  <TableHeader>
                    <TableRow className="print:border-b-2">
                      <TableHead className="print:py-1">Patient</TableHead>
                      <TableHead className="print:py-1">Invoice ID</TableHead>
                      <TableHead className="print:py-1">Date</TableHead>
                      <TableHead className="print:py-1">Type</TableHead>
                      <TableHead className="print:py-1">Status</TableHead>
                      <TableHead className="print:py-1 text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices
                      .filter(inv => {
                        const now = new Date()
                        let startDate: Date
                        switch (selectedPeriod) {
                          case "week":
                            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                            break
                          case "month":
                            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
                            break
                          case "quarter":
                            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
                            break
                          default:
                            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                        }
                        const dateFilter = new Date(inv.date) >= startDate
                        const categoryFilter = reportCategory === "all" || inv.type === reportCategory
                        return dateFilter && categoryFilter
                      })
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map((invoice) => (
                        <TableRow key={invoice.id} className="print:border-b print:py-1">
                          <TableCell className="print:py-1">{invoice.patientName}</TableCell>
                          <TableCell className="print:py-1">{invoice.id}</TableCell>
                          <TableCell className="print:py-1">{new Date(invoice.date).toLocaleDateString()}</TableCell>
                          <TableCell className="print:py-1">
                            <Badge 
                              variant="outline"
                              className={
                                invoice.type === "Cash" ? "border-green-500 text-green-700" :
                                invoice.type === "M-Pesa" ? "border-blue-500 text-blue-700" :
                                "border-purple-500 text-purple-700"
                              }
                            >
                              {invoice.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="print:py-1">
                            <Badge 
                              className={
                                invoice.status === "Paid" ? "bg-green-500" :
                                invoice.status === "Pending" ? "bg-yellow-500" :
                                invoice.status === "Overdue" ? "bg-red-500" :
                                "bg-gray-500"
                              }
                            >
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right print:py-1">KSh {invoice.total.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* SHA Claims Details (if any) */}
            {(reportCategory === "all" || reportCategory === "sha") && invoices.some(inv => inv.type === "SHA") && (
              <div className="border rounded-lg p-4 print:p-2">
                <h3 className="text-lg font-semibold mb-3 print:text-base print:mb-2">SHA Claims Details</h3>
                <div className="overflow-x-auto print:overflow-visible">
                  <Table className="print:text-xs">
                    <TableHeader>
                      <TableRow className="print:border-b-2">
                        <TableHead className="print:py-1">Patient</TableHead>
                        <TableHead className="print:py-1">Member Number</TableHead>
                        <TableHead className="print:py-1">Scheme</TableHead>
                        <TableHead className="print:py-1">Diagnosis</TableHead>
                        <TableHead className="print:py-1">Claim Status</TableHead>
                        <TableHead className="print:py-1 text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices
                        .filter(inv => {
                          const now = new Date()
                          let startDate: Date
                          switch (selectedPeriod) {
                            case "week":
                              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                              break
                            case "month":
                              startDate = new Date(now.getFullYear(), now.getMonth(), 1)
                              break
                            case "quarter":
                              startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
                              break
                            default:
                              startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                          }
                          const dateFilter = new Date(inv.date) >= startDate
                          const shaFilter = inv.type === "SHA"
                          const categoryFilter = reportCategory === "all" || reportCategory === "sha"
                          return dateFilter && shaFilter && categoryFilter
                        })
                        .map((invoice) => (
                          <TableRow key={invoice.id} className="print:border-b print:py-1">
                            <TableCell className="print:py-1">{invoice.patientName}</TableCell>
                            <TableCell className="print:py-1">{invoice.shaDetails?.memberNumber || 'N/A'}</TableCell>
                            <TableCell className="print:py-1">{invoice.shaDetails?.scheme || 'N/A'}</TableCell>
                            <TableCell className="print:py-1">{invoice.shaDetails?.diagnosis || 'N/A'}</TableCell>
                            <TableCell className="print:py-1">
                              <Badge 
                                className={
                                  invoice.shaDetails?.claimStatus === "Approved" ? "bg-green-500" :
                                  invoice.shaDetails?.claimStatus === "Rejected" ? "bg-red-500" :
                                  invoice.shaDetails?.claimStatus === "Submitted" ? "bg-blue-500" :
                                  "bg-yellow-500"
                                }
                              >
                                {invoice.shaDetails?.claimStatus || 'Pending'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right print:py-1">KSh {invoice.total.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-sm text-muted-foreground border-t pt-4 print:pt-2 print:text-xs">
              <p>This report was generated automatically by Seth Medical Clinic Management System</p>
              <p>For inquiries, contact: info@sethmedicalclinic.com | Phone: +254 XXX XXX XXX</p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4 border-t print:hidden">
              <Button variant="outline" onClick={() => setIsReportDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={handlePrintReport}>
                <Printer className="w-4 h-4 mr-2" />
                Print Report
              </Button>
              <Button>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
