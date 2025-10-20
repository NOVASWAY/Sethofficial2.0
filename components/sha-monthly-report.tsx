"use client"

import { useState } from "react"
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

// Mock SHA invoices data
const mockSHAInvoices = [
  {
    id: "INV-2024-001",
    invoiceNumber: "INV-2024-001",
    date: "2024-10-01",
    patientName: "John Doe",
    patientId: "P001",
    memberNumber: "SHA-123456",
    diagnosis: "A09 - Diarrhoea and gastroenteritis",
    services: [
      { code: "OPD-001", name: "Consultation", amount: 500, type: "consultation" },
      { code: "LAB-001", name: "Blood Test", amount: 800, type: "lab" },
    ],
    medications: [
      { name: "ORS Sachets", quantity: "6 sachets", amount: 150 },
      { name: "Metronidazole 400mg", quantity: "21 tablets", amount: 210 },
    ],
    consultationAmount: 500,
    labAmount: 800,
    medicationAmount: 360,
    shaAmount: 1660,
    cashAmount: 0,
    totalAmount: 1660,
    paymentType: "SHA",
  },
  {
    id: "INV-2024-002",
    invoiceNumber: "INV-2024-002",
    date: "2024-10-05",
    patientName: "Jane Smith",
    patientId: "P002",
    memberNumber: "SHA-789012",
    diagnosis: "J06.9 - Acute upper respiratory infection",
    services: [
      { code: "OPD-001", name: "Consultation", amount: 500, type: "consultation" },
    ],
    medications: [
      { name: "Amoxicillin 500mg", quantity: "21 tablets", amount: 630 },
      { name: "Paracetamol 500mg", quantity: "20 tablets", amount: 100 },
      { name: "Cetirizine 10mg", quantity: "10 tablets", amount: 150 },
    ],
    consultationAmount: 500,
    labAmount: 0,
    medicationAmount: 880,
    shaAmount: 1380,
    cashAmount: 0,
    totalAmount: 1380,
    paymentType: "SHA",
  },
  {
    id: "INV-2024-003",
    invoiceNumber: "INV-2024-003",
    date: "2024-10-12",
    patientName: "Peter Kamau",
    patientId: "P003",
    memberNumber: "SHA-345678",
    diagnosis: "I10 - Essential hypertension",
    services: [
      { code: "OPD-001", name: "Consultation", amount: 500, type: "consultation" },
      { code: "LAB-002", name: "ECG", amount: 1500, type: "lab" },
    ],
    medications: [
      { name: "Amlodipine 5mg", quantity: "30 tablets", amount: 450 },
      { name: "Atenolol 50mg", quantity: "30 tablets", amount: 600 },
    ],
    consultationAmount: 500,
    labAmount: 1500,
    medicationAmount: 1050,
    shaAmount: 3050,
    cashAmount: 0,
    totalAmount: 3050,
    paymentType: "SHA",
  },
  {
    id: "INV-2024-004",
    invoiceNumber: "INV-2024-004",
    date: "2024-10-18",
    patientName: "Mary Wanjiku",
    patientId: "P004",
    memberNumber: "SHA-456789",
    diagnosis: "E11 - Type 2 diabetes mellitus",
    services: [
      { code: "OPD-001", name: "Consultation", amount: 500, type: "consultation" },
      { code: "LAB-003", name: "Blood Sugar Test", amount: 600, type: "lab" },
      { code: "LAB-004", name: "HbA1c Test", amount: 800, type: "lab" },
    ],
    medications: [
      { name: "Metformin 500mg", quantity: "60 tablets", amount: 720 },
      { name: "Glibenclamide 5mg", quantity: "30 tablets", amount: 450 },
      { name: "Test Strips", quantity: "50 strips", amount: 1500 },
    ],
    consultationAmount: 500,
    labAmount: 1400,
    medicationAmount: 2670,
    shaAmount: 4070,
    cashAmount: 500,
    totalAmount: 4570,
    paymentType: "Mixed",
  },
]

export function SHAMonthlyReport() {
  const [selectedMonth, setSelectedMonth] = useState("october-2024")
  const [selectedYear, setSelectedYear] = useState("2024")
  const { toast } = useToast()

  const months = [
    { value: "january", label: "January" },
    { value: "february", label: "February" },
    { value: "march", label: "March" },
    { value: "april", label: "April" },
    { value: "may", label: "May" },
    { value: "june", label: "June" },
    { value: "july", label: "July" },
    { value: "august", label: "August" },
    { value: "september", label: "September" },
    { value: "october", label: "October" },
    { value: "november", label: "November" },
    { value: "december", label: "December" },
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Calculate totals
  const totalInvoices = mockSHAInvoices.length
  const totalPatients = new Set(mockSHAInvoices.map((inv) => inv.patientId)).size
  const totalSHAAmount = mockSHAInvoices.reduce((sum, inv) => sum + inv.shaAmount, 0)
  const totalAmount = mockSHAInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)

  const handlePrint = () => {
    toast({
      title: "Preparing Print",
      description: "SHA monthly report is being prepared for printing...",
    })
    setTimeout(() => {
      window.print()
    }, 500)
  }

  const handleExport = () => {
    toast({
      title: "Export Started",
      description: "SHA monthly report is being exported to Excel...",
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

      {/* Alert - Instructions */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>SHA Reimbursement Process:</strong> Select the month, review all SHA invoices, print
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
              <Select
                value={selectedMonth.split("-")[0]}
                onValueChange={(month) => setSelectedMonth(`${month}-${selectedYear}`)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <div className="flex gap-2">
                <Button onClick={handlePrint} className="flex-1">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Report
                </Button>
                <Button onClick={handleExport} variant="outline">
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
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
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
            <CardTitle className="text-sm font-medium">SHA Amount</CardTitle>
            <Shield className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSHAAmount)}</div>
            <p className="text-xs text-muted-foreground">Amount to claim from SHA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <p className="text-xs text-muted-foreground">Total invoice value</p>
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
              Period: {months.find((m) => m.value === selectedMonth.split("-")[0])?.label}{" "}
              {selectedYear}
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
              <p>
                <strong>Facility Name:</strong> Seth Medical Clinic
              </p>
              <p>
                <strong>Facility Code:</strong> SHA-FAC-001
              </p>
              <p>
                <strong>Location:</strong> Nairobi, Kenya
              </p>
              <p>
                <strong>Contact:</strong> +254 712 345 678
              </p>
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
                    <td className="px-4 py-2">Total Number of Invoices</td>
                    <td className="px-4 py-2 text-right font-semibold">{totalInvoices}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-2">Total Patients Served</td>
                    <td className="px-4 py-2 text-right font-semibold">{totalPatients}</td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-2">Total Amount Claimed from SHA</td>
                    <td className="px-4 py-2 text-right font-bold text-lg">
                      {formatCurrency(totalSHAAmount)}
                    </td>
                  </tr>
                  <tr className="border-t bg-muted">
                    <td className="px-4 py-2 font-semibold">Total Invoice Value</td>
                    <td className="px-4 py-2 text-right font-bold">
                      {formatCurrency(totalAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Invoice List */}
          <div>
            <h3 className="font-semibold mb-3">Detailed Invoice List:</h3>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Invoice No.</th>
                    <th className="px-2 py-2 text-left">Patient Name</th>
                    <th className="px-2 py-2 text-left">Member No.</th>
                    <th className="px-2 py-2 text-left">Diagnosis</th>
                    <th className="px-2 py-2 text-right">Consultation</th>
                    <th className="px-2 py-2 text-right">Lab/Tests</th>
                    <th className="px-2 py-2 text-left">Medications</th>
                    <th className="px-2 py-2 text-right">Medicine Cost</th>
                    <th className="px-2 py-2 text-right">SHA Amount</th>
                    <th className="px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {mockSHAInvoices.map((invoice, index) => (
                    <tr key={invoice.id} className="border-t">
                      <td className="px-2 py-2">{index + 1}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs">{formatDate(invoice.date)}</td>
                      <td className="px-2 py-2 text-xs">{invoice.invoiceNumber}</td>
                      <td className="px-2 py-2">{invoice.patientName}</td>
                      <td className="px-2 py-2 text-xs">{invoice.memberNumber}</td>
                      <td className="px-2 py-2 text-xs">{invoice.diagnosis}</td>
                      <td className="px-2 py-2 text-right">
                        {formatCurrency(invoice.consultationAmount)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {invoice.labAmount > 0 ? formatCurrency(invoice.labAmount) : "-"}
                      </td>
                      <td className="px-2 py-2">
                        {invoice.medications && invoice.medications.length > 0 ? (
                          <ul className="text-xs">
                            {invoice.medications.map((med, idx) => (
                              <li key={idx}>
                                • {med.name} ({med.quantity})
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {invoice.medicationAmount > 0 ? formatCurrency(invoice.medicationAmount) : "-"}
                      </td>
                      <td className="px-2 py-2 text-right font-semibold">
                        {formatCurrency(invoice.shaAmount)}
                      </td>
                      <td className="px-2 py-2 text-right">{formatCurrency(invoice.totalAmount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted font-bold">
                    <td colSpan={6} className="px-2 py-2 text-right">
                      TOTALS:
                    </td>
                    <td className="px-2 py-2 text-right">
                      {formatCurrency(mockSHAInvoices.reduce((sum, inv) => sum + inv.consultationAmount, 0))}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {formatCurrency(mockSHAInvoices.reduce((sum, inv) => sum + inv.labAmount, 0))}
                    </td>
                    <td className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right">
                      {formatCurrency(mockSHAInvoices.reduce((sum, inv) => sum + inv.medicationAmount, 0))}
                    </td>
                    <td className="px-2 py-2 text-right text-lg">
                      {formatCurrency(totalSHAAmount)}
                    </td>
                    <td className="px-2 py-2 text-right">{formatCurrency(totalAmount)}</td>
                  </tr>
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
            <p>
              <strong>Important:</strong> This report should be submitted to SHA offices along with
              supporting documents for reimbursement processing.
            </p>
            <p className="mt-2">
              For queries, contact: admin@sethclinic.com | +254 712 345 678
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Submission Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-semibold">
              1
            </div>
            <div>
              <p className="font-medium">Print this Report</p>
              <p className="text-sm text-muted-foreground">
                Click the "Print Report" button above to print this consolidated SHA claims report.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-semibold">
              2
            </div>
            <div>
              <p className="font-medium">Gather Supporting Documents</p>
              <p className="text-sm text-muted-foreground">
                Collect all original invoices, prescriptions, and lab reports for the period.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-semibold">
              3
            </div>
            <div>
              <p className="font-medium">Submit to SHA Office</p>
              <p className="text-sm text-muted-foreground">
                Take the printed report and supporting documents to your nearest SHA office for
                processing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-semibold">
              4
            </div>
            <div>
              <p className="font-medium">Await Reimbursement</p>
              <p className="text-sm text-muted-foreground">
                SHA will review your submission and process the reimbursement to your facility account.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

