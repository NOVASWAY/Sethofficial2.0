"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { invoiceAPI, patientAPI } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { validateForm, validationSchemas } from "@/lib/validation"
import { Separator } from "@/components/ui/separator"
import { Search, Plus, Eye, Edit, Download, DollarSign, Clock, CheckCircle, XCircle, FileText, Shield, Printer, RefreshCw } from "lucide-react"
import { InvoiceReports } from "./invoice-reports"
import { PrintableInvoice } from "@/components/printable-invoice"

interface InvoiceManagementProps {
  role: string
}

interface Invoice {
  id: string
  patientId: string
  patientName: string
  date: string
  dueDate: string
  type: "SHA" | "Cash" | "M-Pesa"
  status: "Pending" | "Paid" | "Overdue" | "Cancelled"
  subtotal: number
  tax: number
  total: number
  services: InvoiceService[]
  shaDetails?: {
    memberNumber: string
    scheme: string
    authorizationCode: string
    preAuthorizationCode?: string
    icd11Code: string
    diagnosis: string
    serviceCode: string
    serviceDescription: string
    practitionerId: string
    practitionerName: string
    facilityCode: string
    claimStatus?: "Pending" | "Submitted" | "Approved" | "Rejected" | "Paid"
    submissionDate?: string
    rejectionReason?: string
  }
  paymentDetails?: {
    method: string
    transactionId: string
    paidDate: string
    mpesaCode?: string
    phoneNumber?: string
  }
  notes: string
}

interface InvoiceService {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

// No mock data - system starts empty
const mockInvoices: Invoice[] = [
  {
    id: "INV-2024-001",
    patientId: "P001",
    patientName: "John Doe",
    date: "2024-01-20",
    dueDate: "2024-02-20",
    type: "SHA",
    status: "Paid",
    subtotal: 15000,
    tax: 2400,
    total: 17400,
    services: [
      { id: "1", description: "General Consultation", quantity: 1, unitPrice: 5000, total: 5000 },
      { id: "2", description: "Blood Pressure Check", quantity: 1, unitPrice: 2000, total: 2000 },
      { id: "3", description: "Prescription Medication", quantity: 2, unitPrice: 4000, total: 8000 },
    ],
    shaDetails: {
      memberNumber: "SHA123456789",
      scheme: "SHA Comprehensive",
      authorizationCode: "AUTH2024001",
      preAuthorizationCode: "PRE-AUTH-2024-001",
      icd11Code: "ICD11-6A00",
      diagnosis: "Type 2 diabetes mellitus",
      serviceCode: "SHA-08-004",
      serviceDescription: "Diabetes consultation and management",
      practitionerId: "PRAC-001",
      practitionerName: "Dr. Sarah Mwangi",
      facilityCode: "FAC-001",
      claimStatus: "Approved",
      submissionDate: "2024-01-15",
    },
    paymentDetails: {
      method: "SHA Reimbursement",
      transactionId: "TXN2024001",
      paidDate: "2024-01-25",
    },
    notes: "Regular checkup covered under SHA scheme",
  },
  {
    id: "INV-2024-002",
    patientId: "P002",
    patientName: "Sarah Johnson",
    date: "2024-01-18",
    dueDate: "2024-01-25",
    type: "Cash",
    status: "Pending",
    subtotal: 8000,
    tax: 1280,
    total: 9280,
    services: [
      { id: "1", description: "Dental Cleaning", quantity: 1, unitPrice: 6000, total: 6000 },
      { id: "2", description: "Fluoride Treatment", quantity: 1, unitPrice: 2000, total: 2000 },
    ],
    notes: "Cash payment - dental services",
  },
  {
    id: "INV-2024-003",
    patientId: "P003",
    patientName: "Michael Brown",
    date: "2024-01-15",
    dueDate: "2024-01-22",
    type: "Cash",
    status: "Overdue",
    subtotal: 12000,
    tax: 1920,
    total: 13920,
    services: [
      { id: "1", description: "Diabetes Consultation", quantity: 1, unitPrice: 7000, total: 7000 },
      { id: "2", description: "HbA1c Test", quantity: 1, unitPrice: 3000, total: 3000 },
      { id: "3", description: "Medication Refill", quantity: 1, unitPrice: 2000, total: 2000 },
    ],
    notes: "Follow-up for diabetes management",
  },
  {
    id: "INV-2024-004",
    patientId: "P004",
    patientName: "Grace Wanjiku",
    date: "2024-01-20",
    dueDate: "2024-01-20",
    type: "M-Pesa",
    status: "Paid",
    subtotal: 3500,
    tax: 560,
    total: 4060,
    services: [
      { id: "1", description: "Consultation", quantity: 1, unitPrice: 2000, total: 2000 },
      { id: "2", description: "Pain Relief Medication", quantity: 1, unitPrice: 1500, total: 1500 },
    ],
    paymentDetails: {
      method: "M-Pesa",
      transactionId: "MP2024001",
      paidDate: "2024-01-20",
      mpesaCode: "QGH2K8M9",
      phoneNumber: "+254712345678"
    },
    notes: "M-Pesa payment - pain management consultation",
  },
  {
    id: "INV-2024-005",
    patientId: "P005",
    patientName: "Peter Kamau",
    date: "2024-01-19",
    dueDate: "2024-01-19",
    type: "M-Pesa",
    status: "Paid",
    subtotal: 6000,
    tax: 960,
    total: 6960,
    services: [
      { id: "1", description: "General Consultation", quantity: 1, unitPrice: 3000, total: 3000 },
      { id: "2", description: "Blood Test", quantity: 1, unitPrice: 1500, total: 1500 },
      { id: "3", description: "Prescription Medication", quantity: 1, unitPrice: 1500, total: 1500 },
    ],
    paymentDetails: {
      method: "M-Pesa",
      transactionId: "MP2024002",
      paidDate: "2024-01-19",
      mpesaCode: "RJK4L7N2",
      phoneNumber: "+254723456789"
    },
    notes: "M-Pesa payment - comprehensive health check",
  },
]

export function InvoiceManagement({ role }: InvoiceManagementProps) {
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false)
  const [isViewInvoiceOpen, setIsViewInvoiceOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Fetch invoices from API
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true)
        const params: { page?: number; per_page?: number; patient_id?: string; payment_status?: string } = {
          page,
          per_page: 50
        }
        
        // Map status filter to backend payment_status
        if (statusFilter !== "all") {
          params.payment_status = statusFilter === "Paid" ? "paid" : 
                                  statusFilter === "Pending" ? "pending" : 
                                  statusFilter === "Overdue" ? "overdue" : "pending"
        }

        const result = await invoiceAPI.getAll(params)
        
        if (result && Array.isArray(result.data)) {
          // Transform API response to match Invoice interface
          const transformed = result.data.map((inv: any) => ({
            id: inv.id || inv.invoice_number || `INV-${inv.id?.slice(0, 8)}`,
            patientId: inv.patient_id,
            patientName: inv.patient_name || `${inv.patient_first_name || ''} ${inv.patient_last_name || ''}`.trim(),
            date: inv.date || inv.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            dueDate: inv.due_date || inv.date || new Date().toISOString().split('T')[0],
            type: (inv.payment_method === 'sha' ? 'SHA' as const :
                   inv.payment_method === 'mpesa' ? 'M-Pesa' as const :
                   inv.payment_method === 'cash' ? 'Cash' as const : 'Cash' as const),
            status: (inv.payment_status === 'paid' ? 'Paid' as const :
                     inv.payment_status === 'pending' ? 'Pending' as const :
                     inv.payment_status === 'overdue' ? 'Overdue' as const :
                     inv.payment_status === 'cancelled' ? 'Cancelled' as const : 'Pending' as const),
            subtotal: inv.subtotal || inv.total_amount - (inv.tax || 0),
            tax: inv.tax || 0,
            total: inv.total_amount || inv.total || 0,
            services: inv.items || inv.services || [],
            shaDetails: inv.sha_details ? {
              memberNumber: inv.sha_details.member_number || '',
              scheme: inv.sha_details.scheme || '',
              authorizationCode: inv.sha_details.authorization_code || '',
              preAuthorizationCode: inv.sha_details.pre_authorization_code,
              icd11Code: inv.sha_details.icd11_code || '',
              diagnosis: inv.sha_details.diagnosis || '',
              serviceCode: inv.sha_details.service_code || '',
              serviceDescription: inv.sha_details.service_description || '',
              practitionerId: inv.sha_details.practitioner_id || '',
              practitionerName: inv.sha_details.practitioner_name || '',
              facilityCode: inv.sha_details.facility_code || '',
              claimStatus: inv.sha_details.claim_status,
              submissionDate: inv.sha_details.submission_date,
              rejectionReason: inv.sha_details.rejection_reason
            } : undefined,
            paymentDetails: inv.payment_status === 'paid' ? {
              method: inv.payment_method || 'Cash',
              transactionId: inv.transaction_id || '',
              paidDate: inv.paid_date || inv.payment_date || '',
              mpesaCode: inv.mpesa_code,
              phoneNumber: inv.phone_number
            } : undefined,
            notes: inv.notes || ''
          }))
          setInvoices(transformed)

          if (result.pagination) {
            setTotalPages(result.pagination.total_pages || 1)
          }
        }
      } catch (error) {
        console.error("Error fetching invoices:", error)
        toast({
          title: "Error",
          description: "Failed to load invoices. Please try again.",
          variant: "destructive"
        })
        // Fallback to empty array on error
        setInvoices([])
      } finally {
        setLoading(false)
      }
    }

    fetchInvoices()
  }, [page, statusFilter, toast])

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.patientId.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter
    const matchesType = typeFilter === "all" || invoice.type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    setIsViewInvoiceOpen(true)
  }

  const handleEditInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice)
    // TODO: Open edit dialog or navigate to edit page
    alert(`Edit functionality for invoice ${invoice.id} will be implemented here.\n\nInvoice Details:\nPatient: ${invoice.patientName}\nAmount: KSh ${invoice.total.toLocaleString()}\nStatus: ${invoice.status}`)
  }

  const handleDownloadInvoice = (invoice: Invoice) => {
    // Create invoice text content
    const invoiceData = `
SETH MEDICAL CLINIC
=====================
Invoice: ${invoice.id}
Date: ${new Date(invoice.date).toLocaleDateString()}

Patient: ${invoice.patientName}
Patient ID: ${invoice.patientId}

Type: ${invoice.type}
Amount: KSh ${invoice.total.toLocaleString()}
Status: ${invoice.status}

Payment Method: ${invoice.paymentDetails?.method || 'N/A'}
${invoice.type === 'SHA' ? `SHA Member: ${invoice.shaDetails?.memberNumber || 'N/A'}` : ''}
=====================
    `.trim()
    
    // Create a blob and download
    const blob = new Blob([invoiceData], { type: 'text/plain' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const canCreateInvoices = role === "receptionist" || role === "admin"
  const canEditInvoices = role === "receptionist" || role === "admin"

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-500"
      case "Pending":
        return "bg-yellow-500"
      case "Overdue":
        return "bg-red-500"
      case "Cancelled":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Paid":
        return CheckCircle
      case "Pending":
        return Clock
      case "Overdue":
        return XCircle
      case "Cancelled":
        return XCircle
      default:
        return Clock
    }
  }

  const totalRevenue = invoices.filter((inv) => inv.status === "Paid").reduce((sum, inv) => sum + inv.total, 0)
  const pendingAmount = invoices.filter((inv) => inv.status === "Pending").reduce((sum, inv) => sum + inv.total, 0)
  const overdueAmount = invoices.filter((inv) => inv.status === "Overdue").reduce((sum, inv) => sum + inv.total, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Invoice Management</h1>
          <p className="text-muted-foreground">Manage SHA and Cash invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={async () => {
              try {
                setLoading(true)
                const params: { page?: number; per_page?: number; payment_status?: string } = {
                  page,
                  per_page: 50
                }
                if (statusFilter !== "all") {
                  params.payment_status = statusFilter === "Paid" ? "paid" : 
                                          statusFilter === "Pending" ? "pending" : 
                                          statusFilter === "Overdue" ? "overdue" : "pending"
                }
                const result = await invoiceAPI.getAll(params)
                if (result && Array.isArray(result.data)) {
                  const transformed = result.data.map((inv: any) => ({
                    id: inv.id || inv.invoice_number || `INV-${inv.id?.slice(0, 8)}`,
                    patientId: inv.patient_id,
                    patientName: inv.patient_name || `${inv.patient_first_name || ''} ${inv.patient_last_name || ''}`.trim(),
                    date: inv.date || inv.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                    dueDate: inv.due_date || inv.date || new Date().toISOString().split('T')[0],
                    type: (inv.payment_method === 'sha' ? 'SHA' as const :
                           inv.payment_method === 'mpesa' ? 'M-Pesa' as const :
                           inv.payment_method === 'cash' ? 'Cash' as const : 'Cash' as const),
                    status: (inv.payment_status === 'paid' ? 'Paid' as const :
                             inv.payment_status === 'pending' ? 'Pending' as const :
                             inv.payment_status === 'overdue' ? 'Overdue' as const :
                             inv.payment_status === 'cancelled' ? 'Cancelled' as const : 'Pending' as const),
                    subtotal: inv.subtotal || inv.total_amount - (inv.tax || 0),
                    tax: inv.tax || 0,
                    total: inv.total_amount || inv.total || 0,
                    services: inv.items || inv.services || [],
                    shaDetails: inv.sha_details,
                    paymentDetails: inv.payment_status === 'paid' ? {
                      method: inv.payment_method || 'Cash',
                      transactionId: inv.transaction_id || '',
                      paidDate: inv.paid_date || inv.payment_date || '',
                      mpesaCode: inv.mpesa_code,
                      phoneNumber: inv.phone_number
                    } : undefined,
                    notes: inv.notes || ''
                  }))
                  setInvoices(transformed)
                  toast({
                    title: "Refreshed",
                    description: "Invoice data has been refreshed.",
                  })
                }
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to refresh invoices.",
                  variant: "destructive"
                })
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canCreateInvoices && (
            <Dialog open={isNewInvoiceOpen} onOpenChange={setIsNewInvoiceOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Create Invoice</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Invoice</DialogTitle>
                  <DialogDescription>Generate a new invoice for patient services</DialogDescription>
                </DialogHeader>
                <NewInvoiceForm onClose={() => setIsNewInvoiceOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Total Revenue</p>
                <p className="text-2xl font-bold">KSh {totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold">KSh {pendingAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-medium">Overdue</p>
                <p className="text-2xl font-bold">KSh {overdueAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Total Invoices</p>
                <p className="text-2xl font-bold">{invoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by invoice ID, patient name, or patient ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="SHA">SHA</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reporting and Printouts */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Reports & Printouts</CardTitle>
          <CardDescription>Generate weekly and monthly invoice reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Weekly Report</p>
                    <p className="text-xs text-muted-foreground">This week's invoices</p>
                  </div>
                </div>
                <Button className="w-full mt-3" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Generate & Print
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-sm font-medium">Monthly Report</p>
                    <p className="text-xs text-muted-foreground">This month's invoices</p>
                  </div>
                </div>
                <Button className="w-full mt-3" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Generate & Print
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">M-Pesa Summary</p>
                    <p className="text-xs text-muted-foreground">Mobile payments report</p>
                  </div>
                </div>
                <Button className="w-full mt-3" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Generate & Print
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">SHA Summary</p>
                    <p className="text-xs text-muted-foreground">Insurance claims report</p>
                  </div>
                </div>
                <Button className="w-full mt-3" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Generate & Print
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>
            {filteredInvoices.length} of {invoices.length} invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading invoices...
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No invoices found
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => {
                const StatusIcon = getStatusIcon(invoice.status)
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.patientName}</p>
                        <p className="text-sm text-muted-foreground">{invoice.patientId}</p>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.type === "SHA" ? "default" : "secondary"}>{invoice.type}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">KSh {invoice.total.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(invoice.status)}`} />
                        <span className="text-sm">{invoice.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)} title="View Invoice">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canEditInvoices && (
                          <Button variant="ghost" size="sm" onClick={() => handleEditInvoice(invoice)} title="Edit Invoice">
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(invoice)} title="Download Invoice">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              }))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              Previous
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Invoice Reports */}
      {!loading && invoices.length > 0 && <InvoiceReports invoices={invoices} role={role} />}

      {/* Invoice Details Dialog */}
      <Dialog open={isViewInvoiceOpen} onOpenChange={setIsViewInvoiceOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>Complete invoice information and payment details</DialogDescription>
          </DialogHeader>
          {selectedInvoice && <InvoiceDetailsView invoice={selectedInvoice} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NewInvoiceForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    patientId: "",
    patientName: "",
    type: "",
    services: [{ description: "", quantity: 1, unitPrice: 0 }],
    shaDetails: {
      memberNumber: "",
      scheme: "",
      authorizationCode: "",
      preAuthorizationCode: "",
      icd11Code: "",
      diagnosis: "",
      serviceCode: "",
      serviceDescription: "",
      practitionerId: "",
      practitionerName: "",
      facilityCode: "",
    },
    phoneNumber: "",
    mpesaCode: "",
    notes: "",
  })

  const addService = () => {
    setFormData((prev) => ({
      ...prev,
      services: [...prev.services, { description: "", quantity: 1, unitPrice: 0 }],
    }))
  }

  const removeService = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }))
  }

  const updateService = (index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      services: prev.services.map((service, i) => (i === index ? { ...service, [field]: value } : service)),
    }))
  }

  const subtotal = formData.services.reduce((sum, service) => sum + service.quantity * service.unitPrice, 0)
  const tax = subtotal * 0.16 // 16% VAT
  const total = subtotal + tax

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Validate form data
      const validation = validateForm(formData, validationSchemas.invoice)
      
      if (!validation.isValid) {
        console.error("Validation errors:", validation.errors)
        return
      }
      
      // Generate invoice number
      const invoiceNumber = `INV${String(Date.now()).slice(-6)}`
      
      // Create new invoice object
      const newInvoice = {
        id: invoiceNumber,
        invoiceNumber,
        patientId: formData.patientId,
        patientName: formData.patientName,
        date: new Date().toISOString().split('T')[0],
        type: formData.type as 'SHA' | 'Cash' | 'M-Pesa',
        subtotal,
        tax,
        total,
        status: 'pending' as const,
        notes: formData.notes,
        shaDetails: formData.type === 'SHA' ? formData.shaDetails : undefined,
        paymentDetails: formData.type === 'M-Pesa' ? {
          method: 'M-Pesa',
          transactionId: '',
          paidDate: '',
          mpesaCode: formData.mpesaCode,
          phoneNumber: formData.phoneNumber
        } : undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // Create invoice via API
      try {
        const invoiceData = {
          patient_id: formData.patientId,
          date: new Date().toISOString().split('T')[0],
          items: formData.services.map(s => ({
            description: s.description,
            quantity: s.quantity,
            unit_price: s.unitPrice,
            total: s.unitPrice * s.quantity
          })),
          subtotal: subtotal,
          tax: tax,
          total_amount: total,
          payment_method: formData.type.toLowerCase(),
          payment_status: 'pending',
          notes: formData.notes || ''
        }

        // Add SHA details if type is SHA
        if (formData.type === 'SHA' && formData.shaDetails) {
          invoiceData.sha_details = {
            member_number: formData.shaDetails.memberNumber,
            scheme: formData.shaDetails.scheme,
            authorization_code: formData.shaDetails.authorizationCode,
            pre_authorization_code: formData.shaDetails.preAuthorizationCode,
            icd11_code: formData.shaDetails.icd11Code,
            diagnosis: formData.shaDetails.diagnosis,
            service_code: formData.shaDetails.serviceCode,
            service_description: formData.shaDetails.serviceDescription,
            practitioner_id: formData.shaDetails.practitionerId,
            practitioner_name: formData.shaDetails.practitionerName,
            facility_code: formData.shaDetails.facilityCode
          }
        }

        await invoiceAPI.create(invoiceData)
        
        toast({
          title: "Invoice Created",
          description: "Invoice has been created successfully.",
        })
        
        // Close form on success
        onClose()
        
        // Refresh invoices list (trigger parent refresh)
        window.location.reload()
      } catch (error) {
        console.error("Error creating invoice:", error)
        toast({
          title: "Error",
          description: "Failed to create invoice. Please try again.",
          variant: "destructive"
        })
      }
      
    } catch (error) {
      console.error("Error creating invoice:", error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="payment">Payment Details</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="patientId">Patient ID</Label>
              <Input
                id="patientId"
                value={formData.patientId}
                onChange={(e) => setFormData((prev) => ({ ...prev, patientId: e.target.value }))}
                placeholder="P001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patientName">Patient Name</Label>
              <Input
                id="patientName"
                value={formData.patientName}
                onChange={(e) => setFormData((prev) => ({ ...prev, patientName: e.target.value }))}
                placeholder="Enter patient name"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Invoice Type</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select invoice type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash Payment</SelectItem>
                <SelectItem value="M-Pesa">M-Pesa Payment</SelectItem>
                <SelectItem value="SHA">SHA Insurance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.type === "SHA" && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-medium">SHA Details - Compliance Required</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="memberNumber">SHA Member Number *</Label>
                  <Input
                    id="memberNumber"
                    value={formData.shaDetails.memberNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, memberNumber: e.target.value },
                      }))
                    }
                    placeholder="SHA123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheme">SHA Scheme *</Label>
                  <Select
                    value={formData.shaDetails.scheme}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, scheme: value },
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select SHA scheme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SHA Comprehensive">SHA Comprehensive</SelectItem>
                      <SelectItem value="SHA Basic">SHA Basic</SelectItem>
                      <SelectItem value="SHA Enhanced">SHA Enhanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authCode">Authorization Code *</Label>
                  <Input
                    id="authCode"
                    value={formData.shaDetails.authorizationCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, authorizationCode: e.target.value },
                      }))
                    }
                    placeholder="AUTH2024001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preAuthCode">Pre-Authorization Code</Label>
                  <Input
                    id="preAuthCode"
                    value={formData.shaDetails.preAuthorizationCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, preAuthorizationCode: e.target.value },
                      }))
                    }
                    placeholder="PRE-AUTH-2024-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icd11Code">ICD-11 Diagnostic Code *</Label>
                  <Input
                    id="icd11Code"
                    value={formData.shaDetails.icd11Code}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, icd11Code: e.target.value },
                      }))
                    }
                    placeholder="ICD11-6A00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diagnosis">Diagnosis Description *</Label>
                  <Input
                    id="diagnosis"
                    value={formData.shaDetails.diagnosis}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, diagnosis: e.target.value },
                      }))
                    }
                    placeholder="Type 2 diabetes mellitus"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceCode">SHA Service Code *</Label>
                  <Input
                    id="serviceCode"
                    value={formData.shaDetails.serviceCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, serviceCode: e.target.value },
                      }))
                    }
                    placeholder="SHA-08-004"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceDescription">Service Description *</Label>
                  <Input
                    id="serviceDescription"
                    value={formData.shaDetails.serviceDescription}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, serviceDescription: e.target.value },
                      }))
                    }
                    placeholder="Diabetes consultation and management"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="practitionerId">Practitioner ID *</Label>
                  <Input
                    id="practitionerId"
                    value={formData.shaDetails.practitionerId}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, practitionerId: e.target.value },
                      }))
                    }
                    placeholder="PRAC-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="practitionerName">Practitioner Name *</Label>
                  <Input
                    id="practitionerName"
                    value={formData.shaDetails.practitionerName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, practitionerName: e.target.value },
                      }))
                    }
                    placeholder="Dr. Sarah Mwangi"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="facilityCode">Facility Code *</Label>
                  <Input
                    id="facilityCode"
                    value={formData.shaDetails.facilityCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shaDetails: { ...prev.shaDetails, facilityCode: e.target.value },
                      }))
                    }
                    placeholder="FAC-001"
                  />
                </div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>SHA Compliance Note:</strong> All fields marked with * are required for SHA reimbursement. 
                  Ensure ICD-11 codes are valid and service codes match SHA tariff structure.
                </p>
              </div>
            </div>
          )}
          {formData.type === "M-Pesa" && (
            <div className="space-y-4 p-4 border rounded-lg">
              <h4 className="font-medium">M-Pesa Payment Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    placeholder="+254712345678"
                    value={formData.phoneNumber || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mpesaCode">M-Pesa Code (Optional)</Label>
                  <Input
                    id="mpesaCode"
                    placeholder="QGH2K8M9"
                    value={formData.mpesaCode || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, mpesaCode: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Services & Items</h4>
            <Button type="button" variant="outline" onClick={addService}>
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </div>
          <div className="space-y-4">
            {formData.services.map((service, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium">Service {index + 1}</h5>
                  {formData.services.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeService(index)}>
                      Remove
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={service.description}
                      onChange={(e) => updateService(index, "description", e.target.value)}
                      placeholder="General Consultation"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={service.quantity}
                      onChange={(e) => updateService(index, "quantity", Number.parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit Price (KSh)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={service.unitPrice}
                      onChange={(e) => updateService(index, "unitPrice", Number.parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">Total: KSh {(service.quantity * service.unitPrice).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-2 text-right">
            <p>Subtotal: KSh {subtotal.toLocaleString()}</p>
            <p>VAT (16%): KSh {tax.toLocaleString()}</p>
            <p className="text-lg font-bold">Total: KSh {total.toLocaleString()}</p>
          </div>
        </TabsContent>

        <TabsContent value="payment" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              rows={4}
              placeholder="Additional notes or instructions..."
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Create Invoice</Button>
      </div>
    </form>
  )
}

function InvoiceDetailsView({ invoice }: { invoice: Invoice }) {
  const { toast } = useToast()
  const [showPrintDialog, setShowPrintDialog] = useState(false)

  // Print invoice function
  const handlePrintInvoice = () => {
    setShowPrintDialog(true)
  }

  // Download as HTML invoice
  const handleDownloadInvoice = () => {
    const invoiceHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice ${invoice.id}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
    .header h1 { margin: 0; color: #2563eb; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
    .info-section { padding: 10px; background: #f5f5f5; border-radius: 5px; }
    .info-section h3 { margin: 0 0 10px 0; font-size: 14px; color: #666; }
    .info-section p { margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #2563eb; color: white; }
    .totals { text-align: right; margin-top: 20px; }
    .totals p { margin: 5px 0; }
    .total { font-size: 20px; font-weight: bold; color: #2563eb; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #333; text-align: center; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SETH MEDICAL CLINIC</h1>
    <p>P.O. Box 12345, Nairobi, Kenya</p>
    <p>Tel: +254 712 345 678 | Email: info@sethmedical.co.ke</p>
  </div>
  
  <div class="info-grid">
    <div class="info-section">
      <h3>INVOICE TO:</h3>
      <p><strong>${invoice.patientName}</strong></p>
      <p>Patient ID: ${invoice.patientId}</p>
    </div>
    <div class="info-section">
      <h3>INVOICE DETAILS:</h3>
      <p><strong>Invoice #:</strong> ${invoice.id}</p>
      <p><strong>Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
      <p><strong>Type:</strong> ${invoice.type}</p>
      <p><strong>Status:</strong> ${invoice.status}</p>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Medical Services</td>
        <td>KSh ${invoice.subtotal.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>
  
  <div class="totals">
    <p><strong>Subtotal:</strong> KSh ${invoice.subtotal.toLocaleString()}</p>
    <p><strong>VAT (16%):</strong> KSh ${invoice.tax.toLocaleString()}</p>
    <p class="total"><strong>TOTAL:</strong> KSh ${invoice.total.toLocaleString()}</p>
  </div>
  
  ${invoice.notes ? `<div style="margin-top: 20px;"><strong>Notes:</strong><p>${invoice.notes}</p></div>` : ''}
  
  <div class="footer">
    <p>Thank you for choosing Seth Medical Clinic</p>
    <p>This is a computer-generated invoice</p>
  </div>
</body>
</html>
    `.trim()

    const blob = new Blob([invoiceHTML], { type: 'text/html' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.id}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const StatusIcon = invoice.status === "Paid" ? CheckCircle : invoice.status === "Pending" ? Clock : XCircle

  return (
    <div className="space-y-6">
      {/* Invoice Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">{invoice.id}</h3>
          <p className="text-muted-foreground">Seth Medical Clinic Invoice</p>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-2 justify-end mb-2">
            <StatusIcon className="w-5 h-5" />
            <Badge
              variant={
                invoice.status === "Paid" ? "default" : invoice.status === "Pending" ? "secondary" : "destructive"
              }
            >
              {invoice.status}
            </Badge>
          </div>
          <Badge variant={invoice.type === "SHA" ? "default" : "outline"}>{invoice.type}</Badge>
        </div>
      </div>

      <Separator />

      {/* Patient & Invoice Info */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-2">Patient Information</h4>
          <div className="space-y-1">
            <p>
              <strong>Name:</strong> {invoice.patientName}
            </p>
            <p>
              <strong>Patient ID:</strong> {invoice.patientId}
            </p>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Invoice Details</h4>
          <div className="space-y-1">
            <p>
              <strong>Date:</strong> {new Date(invoice.date).toLocaleDateString()}
            </p>
            <p>
              <strong>Due Date:</strong> {new Date(invoice.dueDate).toLocaleDateString()}
            </p>
            <p>
              <strong>Type:</strong> {invoice.type}
            </p>
          </div>
        </div>
      </div>

      {/* SHA Details */}
      {invoice.type === "SHA" && invoice.shaDetails && (
        <>
          <Separator />
          <div>
            <h4 className="font-medium mb-2">SHA Insurance Details - Compliance Information</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Member Number</p>
                <p className="font-medium">{invoice.shaDetails.memberNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scheme</p>
                <p className="font-medium">{invoice.shaDetails.scheme}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Authorization Code</p>
                <p className="font-medium">{invoice.shaDetails.authorizationCode}</p>
              </div>
            </div>
            {invoice.shaDetails.preAuthorizationCode && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Pre-Authorization Code</p>
                <p className="font-medium">{invoice.shaDetails.preAuthorizationCode}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm text-muted-foreground">ICD-11 Code</p>
                <p className="font-medium">{invoice.shaDetails.icd11Code}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Diagnosis</p>
                <p className="font-medium">{invoice.shaDetails.diagnosis}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm text-muted-foreground">SHA Service Code</p>
                <p className="font-medium">{invoice.shaDetails.serviceCode}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Service Description</p>
                <p className="font-medium">{invoice.shaDetails.serviceDescription}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm text-muted-foreground">Practitioner ID</p>
                <p className="font-medium">{invoice.shaDetails.practitionerId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Practitioner Name</p>
                <p className="font-medium">{invoice.shaDetails.practitionerName}</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Facility Code</p>
              <p className="font-medium">{invoice.shaDetails.facilityCode}</p>
            </div>
            {invoice.shaDetails.claimStatus && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Claim Status</p>
                <Badge 
                  className={
                    invoice.shaDetails.claimStatus === "Approved" ? "bg-green-500" :
                    invoice.shaDetails.claimStatus === "Rejected" ? "bg-red-500" :
                    invoice.shaDetails.claimStatus === "Submitted" ? "bg-blue-500" :
                    "bg-yellow-500"
                  }
                >
                  {invoice.shaDetails.claimStatus}
                </Badge>
              </div>
            )}
            {invoice.shaDetails.submissionDate && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">Submission Date</p>
                <p className="font-medium">{new Date(invoice.shaDetails.submissionDate).toLocaleDateString()}</p>
              </div>
            )}
            {invoice.shaDetails.rejectionReason && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground">Rejection Reason</p>
                <p className="font-medium text-red-600">{invoice.shaDetails.rejectionReason}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Services */}
      <div>
        <h4 className="font-medium mb-4">Services & Items</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>{service.description}</TableCell>
                <TableCell className="text-center">{service.quantity}</TableCell>
                <TableCell className="text-right">KSh {service.unitPrice.toLocaleString()}</TableCell>
                <TableCell className="text-right">KSh {service.total.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>KSh {invoice.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT (16%):</span>
            <span>KSh {invoice.tax.toLocaleString()}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total:</span>
            <span>KSh {invoice.total.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      {invoice.paymentDetails && (
        <>
          <Separator />
          <div>
            <h4 className="font-medium mb-2">Payment Information</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="font-medium">{invoice.paymentDetails.method}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transaction ID</p>
                <p className="font-medium">{invoice.paymentDetails.transactionId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid Date</p>
                <p className="font-medium">{new Date(invoice.paymentDetails.paidDate).toLocaleDateString()}</p>
              </div>
            </div>
            {invoice.paymentDetails.mpesaCode && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground">M-Pesa Code</p>
                  <p className="font-medium">{invoice.paymentDetails.mpesaCode}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone Number</p>
                  <p className="font-medium">{invoice.paymentDetails.phoneNumber}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Notes */}
      {invoice.notes && (
        <>
          <Separator />
          <div>
            <h4 className="font-medium mb-2">Notes</h4>
            <p className="text-sm">{invoice.notes}</p>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={handleDownloadInvoice}>
          <Download className="w-4 h-4 mr-2" />
          Download HTML
        </Button>
        <Button variant="outline" onClick={handlePrintInvoice}>
          <Printer className="w-4 h-4 mr-2" />
          Print Invoice
        </Button>
        {invoice.status === "Pending" && (
          <Button onClick={async () => {
            try {
              await invoiceAPI.processPayment(invoice.id, {
                payment_method: 'cash',
                amount_paid: invoice.total,
                payment_date: new Date().toISOString().split('T')[0],
                transaction_id: `TXN-${Date.now()}`,
              })
              toast({
                title: "Payment Processed",
                description: `Invoice ${invoice.id} has been marked as paid.`,
              })
              // Refresh invoices list
              window.location.reload()
            } catch (error) {
              toast({
                title: "Error",
                description: "Failed to process payment. Please try again.",
                variant: "destructive"
              })
            }
          }}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark as Paid
          </Button>
        )}
      </div>
      
      {/* Print Dialog */}
      {showPrintDialog && (
        <PrintableInvoice 
          invoice={{
            id: invoice.id,
            invoiceNumber: invoice.id,
            patientId: invoice.patientId,
            patientName: invoice.patientName,
            patientNumber: undefined,
            date: invoice.date,
            dueDate: invoice.dueDate,
            items: invoice.services.map(service => ({
              id: service.id,
              description: service.description,
              quantity: service.quantity,
              unitPrice: service.unitPrice,
              totalPrice: service.total,
              category: 'service' as const
            })),
            subtotal: invoice.subtotal,
            tax: invoice.tax,
            discount: 0,
            total: invoice.total,
            amountPaid: invoice.status === 'Paid' ? invoice.total : 0,
            balance: invoice.status === 'Paid' ? 0 : invoice.total,
            paymentMethod: invoice.type.toLowerCase() as any,
            paymentStatus: invoice.status.toLowerCase() as any,
            invoiceType: invoice.type.toLowerCase() as any,
            notes: invoice.notes,
            shaClaimNumber: invoice.shaDetails?.memberNumber,
            mpesaTransactionCode: invoice.paymentDetails?.mpesaCode,
            createdBy: 'system',
            createdAt: invoice.date,
            updatedAt: invoice.date,
            consultationId: undefined,
            prescriptionId: undefined
          }} 
          onClose={() => setShowPrintDialog(false)} 
        />
      )}
    </div>
  )
}
