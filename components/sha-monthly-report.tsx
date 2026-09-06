"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Shield,
  Printer,
  Download,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Users,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface MonthlyClaim {
  id: string
  claimNumber: string
  patientName: string
  patientShaNumber: string
  totalAmount: number
  approvedAmount: number | null
  status: string
  claimDate: string
  serviceDate: string
  invoice: { invoiceNumber: string } | null
}

interface MonthlySummary {
  year: number
  month: number
  totalClaims: number
  totalAmount: number
  approvedAmount: number
  paidAmount: number
  pendingClaims: number
  approvedClaims: number
  rejectedClaims: number
  paidClaims: number
  claims: MonthlyClaim[]
}

const monthMap: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
}

const monthNames = [
  { value: "january", label: "January" }, { value: "february", label: "February" },
  { value: "march", label: "March" }, { value: "april", label: "April" },
  { value: "may", label: "May" }, { value: "june", label: "June" },
  { value: "july", label: "July" }, { value: "august", label: "August" },
  { value: "september", label: "September" }, { value: "october", label: "October" },
  { value: "november", label: "November" }, { value: "december", label: "December" },
]

export function SHAMonthlyReport() {
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.toLocaleString("en-US", { month: "long" }).toLowerCase())
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()))
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency", currency: "KES", minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric", month: "long", day: "numeric",
    })
  }

  const fetchData = useCallback(async () => {
    const monthNum = monthMap[selectedMonth]
    if (!monthNum) return

    try {
      setLoading(true)
      const res = await fetch(`/api/sha-claims/monthly/${selectedYear}/${monthNum}`)
      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          setSummary(result.data)
        }
      }
    } catch {
      // Failed to load
    } finally {
      setLoading(false)
    }
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const claims = summary?.claims || []
  const totalClaims = summary?.totalClaims || 0
  const totalPatients = new Set(claims.map((c) => c.patientName)).size
  const totalSHAAmount = summary?.totalAmount || 0
  const approvedAmount = summary?.approvedAmount || 0
  const paidAmount = summary?.paidAmount || 0

  const handlePrint = () => {
    toast({
      title: "Preparing Print",
      description: "SHA monthly report is being prepared for printing...",
    })
    setTimeout(() => window.print(), 500)
  }

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "SHA monthly report is being exported...",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">SHA Monthly Report</h2>
          <p className="text-muted-foreground">
            Consolidated SHA insurance claims for reimbursement submission
          </p>
        </div>
      </div>

      {/* Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>SHA Reimbursement Process:</strong> Select the month, review all SHA claims, print
          this consolidated report, and submit it to SHA offices for fund reimbursement.
        </AlertDescription>
      </Alert>

      {/* Period Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Period</CardTitle>
          <CardDescription>Choose month and year for SHA report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthNames.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button onClick={handlePrint} className="flex-1" disabled={loading}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Button>
                <Button onClick={handleExport} variant="outline" disabled={loading}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClaims}</div>
            <p className="text-xs text-muted-foreground">SHA claims this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPatients}</div>
            <p className="text-xs text-muted-foreground">Unique patients served</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claimed</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSHAAmount)}</div>
            <p className="text-xs text-muted-foreground">Amount claimed from SHA</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(paidAmount)}</div>
            <p className="text-xs text-muted-foreground">Amount paid by SHA</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Pending</Badge>
              <span className="text-2xl font-bold">{summary?.pendingClaims || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">Approved</Badge>
              <span className="text-2xl font-bold">{summary?.approvedClaims || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-red-50 text-red-700">Rejected</Badge>
              <span className="text-2xl font-bold">{summary?.rejectedClaims || 0}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700">Paid</Badge>
              <span className="text-2xl font-bold">{summary?.paidClaims || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Printable Report */}
      <Card id="printable-sha-report">
        <CardHeader className="border-b">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Shield className="h-8 w-8 text-purple-600" />
              <h1 className="text-2xl font-bold">SETH MEDICAL CLINIC</h1>
            </div>
            <h2 className="text-xl font-semibold">SHA Insurance Claims Report</h2>
            <p className="text-muted-foreground">
              Period: {monthNames.find((m) => m.value === selectedMonth)?.label} {selectedYear}
            </p>
            <p className="text-sm text-muted-foreground">
              Generated on: {new Date().toLocaleDateString("en-KE")}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Clinic Details */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Facility Information:</h3>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              <p><strong>Facility Name:</strong> Seth Medical Clinic</p>
              <p><strong>Facility Code:</strong> SHA-FAC-001</p>
              <p><strong>Location:</strong> Nairobi, Kenya</p>
              <p><strong>Contact:</strong> +254 712 345 678</p>
            </div>
          </div>

          {/* Summary Table */}
          <div className="mb-6">
            <h3 className="font-semibold mb-3">Monthly Summary:</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Metric</th>
                    <th className="px-4 py-2 text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-4 py-2">Total Number of Claims</td>
                    <td className="px-4 py-2 text-right font-semibold">{totalClaims}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-2">Total Patients Served</td>
                    <td className="px-4 py-2 text-right font-semibold">{totalPatients}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-2">Total Amount Claimed from SHA</td>
                    <td className="px-4 py-2 text-right font-bold text-lg">{formatCurrency(totalSHAAmount)}</td>
                  </tr>
                  <tr className="border-t bg-muted">
                    <td className="px-4 py-2 font-semibold">Total Amount Approved</td>
                    <td className="px-4 py-2 text-right font-bold">{formatCurrency(approvedAmount)}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-2 font-semibold">Total Amount Paid</td>
                    <td className="px-4 py-2 text-right font-bold text-green-600">{formatCurrency(paidAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Claims List */}
          <div>
            <h3 className="font-semibold mb-3">Detailed Claims List:</h3>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Claim Date</th>
                    <th className="px-2 py-2 text-left">Claim Number</th>
                    <th className="px-2 py-2 text-left">Invoice No.</th>
                    <th className="px-2 py-2 text-left">Patient Name</th>
                    <th className="px-2 py-2 text-left">SHA Number</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                    <th className="px-2 py-2 text-right">Approved</th>
                    <th className="px-2 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim, index) => (
                    <tr key={claim.id} className="border-t">
                      <td className="px-2 py-2">{index + 1}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">{formatDate(claim.claimDate)}</td>
                      <td className="px-2 py-2 text-xs">{claim.claimNumber}</td>
                      <td className="px-2 py-2 text-xs">{claim.invoice?.invoiceNumber || "-"}</td>
                      <td className="px-2 py-2">{claim.patientName}</td>
                      <td className="px-2 py-2 text-xs">{claim.patientShaNumber || "-"}</td>
                      <td className="px-2 py-2 text-right font-semibold">{formatCurrency(Number(claim.totalAmount))}</td>
                      <td className="px-2 py-2 text-right">{claim.approvedAmount ? formatCurrency(Number(claim.approvedAmount)) : "-"}</td>
                      <td className="px-2 py-2">
                        <Badge variant={
                          claim.status === "paid" ? "default" :
                          claim.status === "approved" ? "secondary" :
                          claim.status === "rejected" ? "destructive" : "outline"
                        }>
                          {claim.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {claims.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        No claims found for this period
                      </td>
                    </tr>
                  )}
                  {claims.length > 0 && (
                    <tr className="border-t bg-muted font-bold">
                      <td colSpan={6} className="px-2 py-2 text-right">TOTALS:</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(totalSHAAmount)}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(approvedAmount)}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature Section */}
          <div className="mt-8 pt-6 border-t grid md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Prepared By:</p>
              <div className="border-t border-black mt-12 pt-1">
                <p className="text-sm">Name: _________________________</p>
                <p className="text-sm">Position: _____________________</p>
                <p className="text-sm">Date: _________________________</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Approved By:</p>
              <div className="border-t border-black mt-12 pt-1">
                <p className="text-sm">Name: _________________________</p>
                <p className="text-sm">Position: _____________________</p>
                <p className="text-sm">Date: _________________________</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t text-center text-xs text-muted-foreground">
            <p><strong>Important:</strong> This report should be submitted to SHA offices along with supporting documents for reimbursement processing.</p>
            <p className="mt-2">For queries, contact: admin@sethclinic.com | +254 712 345 678</p>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { num: 1, title: "Print this Report", desc: "Click the \"Print Report\" button above to print this consolidated SHA claims report." },
            { num: 2, title: "Gather Supporting Documents", desc: "Collect all original invoices, prescriptions, and lab reports for the period." },
            { num: 3, title: "Submit to SHA Office", desc: "Take the printed report and supporting documents to your nearest SHA office for processing." },
            { num: 4, title: "Await Reimbursement", desc: "SHA will review your submission and process the reimbursement to your facility account." },
          ].map((step) => (
            <div key={step.num} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-semibold">
                {step.num}
              </div>
              <div>
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
