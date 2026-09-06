"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
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
import { Separator } from "@/components/ui/separator"
import {
  Search,
  Plus,
  Eye,
  Edit,
  AlertTriangle,
  Package,
  FileText,
  ShoppingCart,
  TrendingDown,
  Clock,
  UserPlus,
  User,
  Receipt,
  Download,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react"

interface PharmacyManagementProps {
  role: string
}

interface Medication {
  id: string
  name: string
  genericName: string
  category: string
  manufacturer: string
  batchNumber: string
  expiryDate: string
  quantity: number
  unitPrice: number
  reorderLevel: number
  location: string
  description: string
  sideEffects: string[]
  dosageForm: string
  strength: string
  status: "In Stock" | "Low Stock" | "Out of Stock" | "Expired"
}

interface Prescription {
  id: string
  patientId: string
  patientName: string
  prescribedBy: string
  date: string
  medications: PrescriptionMedication[]
  status: "Pending" | "Dispensed" | "Partially Dispensed" | "Cancelled"
  notes: string
}

interface PrescriptionMedication {
  medicationId: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  quantity: number
  instructions: string
}

interface WalkInSale {
  id: string
  customerName: string
  customerPhone: string
  date: string
  items: SaleItem[]
  totalAmount: number
  paymentMethod: string
  status: "Completed" | "Pending"
}

interface SaleItem {
  medicationId: string
  medicationName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

function computeMedStatus(med: { currentStock: number; reorderLevel: number; expiryDate?: string | Date | null }): Medication['status'] {
  if (med.currentStock === 0) return "Out of Stock"
  if (med.expiryDate && new Date(med.expiryDate) < new Date()) return "Expired"
  if (med.currentStock <= med.reorderLevel) return "Low Stock"
  return "In Stock"
}

export function PharmacyManagement({ role }: PharmacyManagementProps) {
  const [medications, setMedications] = useState<Medication[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [walkInSales, setWalkInSales] = useState<WalkInSale[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("inventory")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [isNewMedicationOpen, setIsNewMedicationOpen] = useState(false)
  const [isViewMedicationOpen, setIsViewMedicationOpen] = useState(false)
  const [isViewPrescriptionOpen, setIsViewPrescriptionOpen] = useState(false)
  const [isNewWalkInSaleOpen, setIsNewWalkInSaleOpen] = useState(false)

  const fetchMedications = useCallback(async () => {
    try {
      const res = await fetch("/api/medicines?limit=200")
      if (!res.ok) throw new Error("Failed to fetch medicines")
      const data = await res.json()
      const raw = data.medicines || data || []
      const mapped: Medication[] = raw.map((m: any) => ({
        id: m.id,
        name: m.name,
        genericName: m.genericName || "",
        category: m.category || "",
        manufacturer: m.manufacturer || "",
        batchNumber: m.batchNumber || "",
        expiryDate: m.expiryDate ? m.expiryDate.split("T")[0] : "",
        quantity: m.currentStock ?? 0,
        unitPrice: Number(m.unitPrice) || 0,
        reorderLevel: m.reorderLevel ?? 10,
        location: m.location || "",
        description: m.description || "",
        sideEffects: typeof m.sideEffects === "string"
          ? (m.sideEffects ? m.sideEffects.split(",").map((s: string) => s.trim()) : [])
          : Array.isArray(m.sideEffects) ? m.sideEffects : [],
        dosageForm: m.dosageForm || "",
        strength: m.strength || "",
        status: computeMedStatus(m),
      }))
      setMedications(mapped)
    } catch (err) {
      console.error("Failed to load medications:", err)
    }
  }, [])

  const fetchPrescriptions = useCallback(async () => {
    try {
      const res = await fetch("/api/prescriptions?limit=200")
      if (!res.ok) throw new Error("Failed to fetch prescriptions")
      const data = await res.json()
      const raw = data.prescriptions || data || []
      const mapped: Prescription[] = raw.map((p: any) => ({
        id: p.prescriptionNumber || p.id,
        patientId: p.patientId || "",
        patientName: p.patient
          ? `${p.patient.firstName || ""} ${p.patient.lastName || ""}`.trim() || "Unknown Patient"
          : "Unknown Patient",
        prescribedBy: p.doctor?.name || "Unknown",
        date: p.createdAt ? p.createdAt.split("T")[0] : "",
        status: p.dispensed ? "Dispensed" : (p.status === "cancelled" ? "Cancelled" : "Pending"),
        notes: p.instructions || "",
        medications: (p.items || []).map((item: any) => ({
          medicationId: item.medicationId || "",
          medicationName: item.medicationName || item.medication?.name || "Unknown",
          dosage: item.dosage || "",
          frequency: item.frequency || "",
          duration: item.durationDays ? `${item.durationDays} days` : "",
          quantity: item.quantity || 0,
          instructions: item.instructions || "",
        })),
      }))
      setPrescriptions(mapped)
    } catch (err) {
      console.error("Failed to load prescriptions:", err)
    }
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([fetchMedications(), fetchPrescriptions()])
      setLoading(false)
    }
    loadAll()
  }, [fetchMedications, fetchPrescriptions])

  const filteredMedications = medications.filter((med) => {
    const matchesSearch =
      med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      med.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      med.id.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = categoryFilter === "all" || med.category === categoryFilter
    const matchesStatus = statusFilter === "all" || med.status === statusFilter

    return matchesSearch && matchesCategory && matchesStatus
  })

  const filteredPrescriptions = prescriptions.filter(
    (rx) =>
      rx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.patientId.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleViewMedication = (medication: Medication) => {
    setSelectedMedication(medication)
    setIsViewMedicationOpen(true)
  }

  const handleViewPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription)
    setIsViewPrescriptionOpen(true)
  }

  const canManageInventory = role === "pharmacist" || role === "admin"
  const canDispenseMedication = role === "pharmacist" || role === "admin"
  const canCreateInvoices = role === "pharmacist" || role === "receptionist" || role === "admin"

  const getStatusColor = (status: string) => {
    switch (status) {
      case "In Stock":
        return "bg-green-500"
      case "Low Stock":
        return "bg-yellow-500"
      case "Out of Stock":
        return "bg-red-500"
      case "Expired":
        return "bg-gray-500"
      default:
        return "bg-gray-500"
    }
  }

  const lowStockItems = medications.filter((med) => med.quantity <= med.reorderLevel && med.quantity > 0).length
  const outOfStockItems = medications.filter((med) => med.quantity === 0).length
  const expiredItems = medications.filter((med) => new Date(med.expiryDate) < new Date()).length
  const totalValue = medications.reduce((sum, med) => sum + med.quantity * med.unitPrice, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Pharmacy Management</h1>
          <p className="text-muted-foreground">Manage inventory and prescriptions</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => { fetchMedications(); fetchPrescriptions() }}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canDispenseMedication && (
            <Dialog open={isNewWalkInSaleOpen} onOpenChange={setIsNewWalkInSaleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2 bg-transparent">
                  <UserPlus className="w-4 h-4" />
                  <span>Walk-in Sale</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Walk-in Sale</DialogTitle>
                  <DialogDescription>Record medicine sale to walk-in customer</DialogDescription>
                </DialogHeader>
                <WalkInSaleForm
                  medications={medications}
                  onClose={() => setIsNewWalkInSaleOpen(false)}
                  onSave={(sale) => {
                    setWalkInSales((prev) => [sale, ...prev])
                    setIsNewWalkInSaleOpen(false)
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
          {canManageInventory && (
            <Dialog open={isNewMedicationOpen} onOpenChange={setIsNewMedicationOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Add Medication</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Medication</DialogTitle>
                  <DialogDescription>Enter medication details to add to inventory</DialogDescription>
                </DialogHeader>
                <NewMedicationForm onClose={() => setIsNewMedicationOpen(false)} />
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
              <Package className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Total Items</p>
                <p className="text-2xl font-bold">{medications.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Low Stock</p>
                <p className="text-2xl font-bold">{lowStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-medium">Out of Stock</p>
                <p className="text-2xl font-bold">{outOfStockItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium">Expired</p>
                <p className="text-2xl font-bold">{expiredItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="walk-in">Walk-in Sales</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search medications by name, generic name, or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Analgesic">Analgesic</SelectItem>
                    <SelectItem value="Antibiotic">Antibiotic</SelectItem>
                    <SelectItem value="Antidiabetic">Antidiabetic</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="In Stock">In Stock</SelectItem>
                    <SelectItem value="Low Stock">Low Stock</SelectItem>
                    <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Inventory List */}
          <Card>
            <CardHeader>
              <CardTitle>Medication Inventory</CardTitle>
              <CardDescription>
                {filteredMedications.length} of {medications.length} medications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medication</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMedications.map((medication) => (
                    <TableRow key={medication.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{medication.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {medication.genericName} - {medication.strength}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{medication.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{medication.quantity}</p>
                          <p className="text-sm text-muted-foreground">Reorder: {medication.reorderLevel}</p>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(medication.expiryDate).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(medication.status)}`} />
                          <span className="text-sm">{medication.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleViewMedication(medication)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canManageInventory && (
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions" className="space-y-4">
          {/* Prescription Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search prescriptions by ID, patient name, or patient ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Prescriptions List */}
          <Card>
            <CardHeader>
              <CardTitle>Prescriptions</CardTitle>
              <CardDescription>
                {filteredPrescriptions.length} of {prescriptions.length} prescriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prescription ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Prescribed By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions.map((prescription) => (
                    <TableRow key={prescription.id}>
                      <TableCell className="font-medium">{prescription.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{prescription.patientName}</p>
                          <p className="text-sm text-muted-foreground">{prescription.patientId}</p>
                        </div>
                      </TableCell>
                      <TableCell>{prescription.prescribedBy}</TableCell>
                      <TableCell>{new Date(prescription.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            prescription.status === "Dispensed"
                              ? "default"
                              : prescription.status === "Pending"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {prescription.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleViewPrescription(prescription)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canDispenseMedication && prescription.status === "Pending" && (
                            <Button variant="ghost" size="sm">
                              <ShoppingCart className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="walk-in" className="space-y-4">
          {/* Walk-in Sales Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search walk-in sales by ID, customer name, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Walk-in Sales List */}
          <Card>
            <CardHeader>
              <CardTitle>Walk-in Sales</CardTitle>
              <CardDescription>{walkInSales.length} total sales</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sale ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {walkInSales
                    .filter(
                      (sale) =>
                        sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        sale.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        sale.customerPhone.includes(searchTerm),
                    )
                    .map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">{sale.id}</TableCell>
                        <TableCell>{sale.customerName}</TableCell>
                        <TableCell>{sale.customerPhone}</TableCell>
                        <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                        <TableCell>{sale.items.length} item(s)</TableCell>
                        <TableCell className="font-medium">KSh {sale.totalAmount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.paymentMethod}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sale.status === "Completed" ? "default" : "secondary"}>{sale.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          {/* Billing Options */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Receipt className="w-5 h-5" />
                  <span>Patient Billing</span>
                </CardTitle>
                <CardDescription>Create invoices for patient visits and medications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Bill patients for:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• Prescription medications</li>
                    <li>• Full visit consultations</li>
                    <li>• Additional services</li>
                    <li>• SHA insurance claims</li>
                  </ul>
                </div>
                <div className="flex space-x-2">
                  <Button className="flex-1">
                    <Receipt className="w-4 h-4 mr-2" />
                    Create Patient Invoice
                  </Button>
                  <Button variant="outline">
                    <User className="w-4 h-4 mr-2" />
                    View Patient Bills
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <UserPlus className="w-5 h-5" />
                  <span>Non-Patient Sales</span>
                </CardTitle>
                <CardDescription>Process sales for walk-in customers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Sell to customers:</p>
                  <ul className="text-sm space-y-1 ml-4">
                    <li>• Over-the-counter medications</li>
                    <li>• Health supplements</li>
                    <li>• Medical supplies</li>
                    <li>• Prescription refills</li>
                  </ul>
                </div>
                <div className="flex space-x-2">
                  <Button className="flex-1">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    New Walk-in Sale
                  </Button>
                  <Button variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    Sales History
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Billing Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Billing Activity</CardTitle>
              <CardDescription>Latest invoices and sales transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Customer/Patient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    {
                      id: "INV-2024-001",
                      customer: "John Doe",
                      type: "Patient Invoice",
                      amount: 2500,
                      status: "Paid",
                      date: "2024-01-20"
                    },
                    {
                      id: "WS-2024-001",
                      customer: "Jane Smith",
                      type: "Walk-in Sale",
                      amount: 150,
                      status: "Completed",
                      date: "2024-01-20"
                    },
                    {
                      id: "INV-2024-002",
                      customer: "Mike Wilson",
                      type: "Patient Invoice",
                      amount: 1800,
                      status: "Pending",
                      date: "2024-01-19"
                    }
                  ].map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.id}</TableCell>
                      <TableCell>{transaction.customer}</TableCell>
                      <TableCell>
                        <Badge variant={transaction.type === "Patient Invoice" ? "default" : "secondary"}>
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">KSh {transaction.amount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={transaction.status === "Paid" || transaction.status === "Completed" ? "bg-green-500" : "bg-yellow-500"}>
                          {transaction.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {/* Stock Alerts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span>Low Stock Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {medications
                    .filter((med) => med.quantity <= med.reorderLevel && med.quantity > 0)
                    .map((med) => (
                      <div key={med.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{med.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Current: {med.quantity} | Reorder: {med.reorderLevel}
                          </p>
                        </div>
                        <Badge variant="secondary">Low Stock</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-red-600" />
                  <span>Expiry Alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {medications
                    .filter((med) => {
                      const expiryDate = new Date(med.expiryDate)
                      const today = new Date()
                      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
                      return expiryDate <= thirtyDaysFromNow
                    })
                    .map((med) => (
                      <div key={med.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{med.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Expires: {new Date(med.expiryDate).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="destructive">
                          {new Date(med.expiryDate) < new Date() ? "Expired" : "Expiring Soon"}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Medication Details Dialog */}
      <Dialog open={isViewMedicationOpen} onOpenChange={setIsViewMedicationOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Medication Details</DialogTitle>
            <DialogDescription>Complete medication information and inventory details</DialogDescription>
          </DialogHeader>
          {selectedMedication && <MedicationDetailsView medication={selectedMedication} />}
        </DialogContent>
      </Dialog>

      {/* Prescription Details Dialog */}
      <Dialog open={isViewPrescriptionOpen} onOpenChange={setIsViewPrescriptionOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prescription Details</DialogTitle>
            <DialogDescription>Complete prescription information and dispensing details</DialogDescription>
          </DialogHeader>
          {selectedPrescription && <PrescriptionDetailsView prescription={selectedPrescription} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NewMedicationForm({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    genericName: "",
    category: "",
    manufacturer: "",
    batchNumber: "",
    expiryDate: "",
    quantity: 0,
    unitPrice: 0,
    reorderLevel: 0,
    location: "",
    description: "",
    sideEffects: "",
    dosageForm: "",
    strength: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/medicines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          genericName: formData.genericName,
          category: formData.category,
          manufacturer: formData.manufacturer,
          batchNumber: formData.batchNumber,
          expiryDate: formData.expiryDate || null,
          currentStock: formData.quantity,
          unitPrice: formData.unitPrice,
          reorderLevel: formData.reorderLevel,
          location: formData.location,
          description: formData.description,
          sideEffects: formData.sideEffects,
          dosageForm: formData.dosageForm,
          strength: formData.strength,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to create medication")
      }
      onClose()
      window.location.reload()
    } catch (err: any) {
      setError(err.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Medication Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="genericName">Generic Name</Label>
          <Input
            id="genericName"
            value={formData.genericName}
            onChange={(e) => setFormData((prev) => ({ ...prev, genericName: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Analgesic">Analgesic</SelectItem>
              <SelectItem value="Antibiotic">Antibiotic</SelectItem>
              <SelectItem value="Antidiabetic">Antidiabetic</SelectItem>
              <SelectItem value="Cardiovascular">Cardiovascular</SelectItem>
              <SelectItem value="Respiratory">Respiratory</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dosageForm">Dosage Form</Label>
          <Select
            value={formData.dosageForm}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, dosageForm: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select form" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Tablet">Tablet</SelectItem>
              <SelectItem value="Capsule">Capsule</SelectItem>
              <SelectItem value="Syrup">Syrup</SelectItem>
              <SelectItem value="Injection">Injection</SelectItem>
              <SelectItem value="Cream">Cream</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="strength">Strength</Label>
          <Input
            id="strength"
            value={formData.strength}
            onChange={(e) => setFormData((prev) => ({ ...prev, strength: e.target.value }))}
            placeholder="e.g., 500mg"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            value={formData.manufacturer}
            onChange={(e) => setFormData((prev) => ({ ...prev, manufacturer: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="batchNumber">Batch Number</Label>
          <Input
            id="batchNumber"
            value={formData.batchNumber}
            onChange={(e) => setFormData((prev) => ({ ...prev, batchNumber: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            min="0"
            value={formData.quantity}
            onChange={(e) => setFormData((prev) => ({ ...prev, quantity: Number.parseInt(e.target.value) || 0 }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unitPrice">Unit Price (KSh)</Label>
          <Input
            id="unitPrice"
            type="number"
            min="0"
            step="0.01"
            value={formData.unitPrice}
            onChange={(e) => setFormData((prev) => ({ ...prev, unitPrice: Number.parseFloat(e.target.value) || 0 }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reorderLevel">Reorder Level</Label>
          <Input
            id="reorderLevel"
            type="number"
            min="0"
            value={formData.reorderLevel}
            onChange={(e) => setFormData((prev) => ({ ...prev, reorderLevel: Number.parseInt(e.target.value) || 0 }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiryDate">Expiry Date</Label>
          <Input
            id="expiryDate"
            type="date"
            value={formData.expiryDate}
            onChange={(e) => setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Storage Location</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
          placeholder="e.g., Shelf A1"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sideEffects">Side Effects (comma-separated)</Label>
        <Input
          id="sideEffects"
          value={formData.sideEffects}
          onChange={(e) => setFormData((prev) => ({ ...prev, sideEffects: e.target.value }))}
          placeholder="e.g., Nausea, Dizziness, Headache"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
          ) : "Add Medication"}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </form>
  )
}

function MedicationDetailsView({ medication }: { medication: Medication }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-2">Basic Information</h4>
          <div className="space-y-2">
            <p>
              <strong>Name:</strong> {medication.name}
            </p>
            <p>
              <strong>Generic Name:</strong> {medication.genericName}
            </p>
            <p>
              <strong>Category:</strong> {medication.category}
            </p>
            <p>
              <strong>Strength:</strong> {medication.strength}
            </p>
            <p>
              <strong>Dosage Form:</strong> {medication.dosageForm}
            </p>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Inventory Details</h4>
          <div className="space-y-2">
            <p>
              <strong>Quantity:</strong> {medication.quantity}
            </p>
            <p>
              <strong>Unit Price:</strong> KSh {medication.unitPrice}
            </p>
            <p>
              <strong>Reorder Level:</strong> {medication.reorderLevel}
            </p>
            <p>
              <strong>Location:</strong> {medication.location}
            </p>
            <p>
              <strong>Status:</strong> <Badge variant="outline">{medication.status}</Badge>
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-2">Manufacturing Details</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Manufacturer</p>
            <p className="font-medium">{medication.manufacturer}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Batch Number</p>
            <p className="font-medium">{medication.batchNumber}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expiry Date</p>
            <p className="font-medium">{new Date(medication.expiryDate).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-2">Description</h4>
        <p className="text-sm">{medication.description}</p>
      </div>

      <div>
        <h4 className="font-medium mb-2">Side Effects</h4>
        <div className="flex flex-wrap gap-2">
          {medication.sideEffects.map((effect, index) => (
            <Badge key={index} variant="secondary">
              {effect}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  )
}

function PrescriptionDetailsView({ prescription }: { prescription: Prescription }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-2">Patient Information</h4>
          <div className="space-y-2">
            <p>
              <strong>Name:</strong> {prescription.patientName}
            </p>
            <p>
              <strong>Patient ID:</strong> {prescription.patientId}
            </p>
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-2">Prescription Details</h4>
          <div className="space-y-2">
            <p>
              <strong>Prescription ID:</strong> {prescription.id}
            </p>
            <p>
              <strong>Prescribed By:</strong> {prescription.prescribedBy}
            </p>
            <p>
              <strong>Date:</strong> {new Date(prescription.date).toLocaleDateString()}
            </p>
            <p>
              <strong>Status:</strong> <Badge variant="outline">{prescription.status}</Badge>
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium mb-4">Prescribed Medications</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medication</TableHead>
              <TableHead>Dosage</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prescription.medications.map((med, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{med.medicationName}</TableCell>
                <TableCell>{med.dosage}</TableCell>
                <TableCell>{med.frequency}</TableCell>
                <TableCell>{med.duration}</TableCell>
                <TableCell>{med.quantity}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <h4 className="font-medium mb-2">Instructions</h4>
        <div className="space-y-2">
          {prescription.medications.map((med, index) => (
            <div key={index} className="p-3 border rounded-lg">
              <p className="font-medium">{med.medicationName}</p>
              <p className="text-sm text-muted-foreground">{med.instructions}</p>
            </div>
          ))}
        </div>
      </div>

      {prescription.notes && (
        <div>
          <h4 className="font-medium mb-2">Notes</h4>
          <p className="text-sm">{prescription.notes}</p>
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Print Prescription
        </Button>
        {prescription.status === "Pending" && (
          <Button>
            <ShoppingCart className="w-4 h-4 mr-2" />
            Dispense Medication
          </Button>
        )}
      </div>
    </div>
  )
}

function WalkInSaleForm({
  medications,
  onClose,
  onSave,
}: {
  medications: Medication[]
  onClose: () => void
  onSave: (sale: WalkInSale) => void
}) {
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    paymentMethod: "Cash",
  })

  const [selectedItems, setSelectedItems] = useState<SaleItem[]>([])
  const [currentItem, setCurrentItem] = useState({
    medicationId: "",
    quantity: 1,
  })

  const availableMedications = medications.filter((med) => med.quantity > 0 && med.status === "In Stock")

  const handleAddItem = () => {
    const medication = medications.find((med) => med.id === currentItem.medicationId)
    if (!medication || currentItem.quantity <= 0) return

    const totalPrice = medication.unitPrice * currentItem.quantity

    const newItem: SaleItem = {
      medicationId: medication.id,
      medicationName: `${medication.name} ${medication.strength}`,
      quantity: currentItem.quantity,
      unitPrice: medication.unitPrice,
      totalPrice,
    }

    setSelectedItems((prev) => [...prev, newItem])
    setCurrentItem({ medicationId: "", quantity: 1 })
  }

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index))
  }

  const totalAmount = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedItems.length === 0) return

    const newSale: WalkInSale = {
      id: `WS${String(Date.now()).slice(-6)}`,
      customerName: formData.customerName,
      customerPhone: formData.customerPhone,
      date: new Date().toISOString().split("T")[0],
      items: selectedItems,
      totalAmount,
      paymentMethod: formData.paymentMethod,
      status: "Completed",
    }

    onSave(newSale)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Information */}
      <div className="space-y-4">
        <h4 className="font-medium">Customer Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name</Label>
            <Input
              id="customerName"
              value={formData.customerName}
              onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
              placeholder="Enter customer name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Phone Number</Label>
            <Input
              id="customerPhone"
              value={formData.customerPhone}
              onChange={(e) => setFormData((prev) => ({ ...prev, customerPhone: e.target.value }))}
              placeholder="+254..."
              required
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Add Items */}
      <div className="space-y-4">
        <h4 className="font-medium">Add Items</h4>
        <div className="flex gap-4">
          <div className="flex-1">
            <Label htmlFor="medication">Select Medication</Label>
            <Select
              value={currentItem.medicationId}
              onValueChange={(value) => setCurrentItem((prev) => ({ ...prev, medicationId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select medication" />
              </SelectTrigger>
              <SelectContent>
                {availableMedications.map((med) => (
                  <SelectItem key={med.id} value={med.id}>
                    {med.name} {med.strength} - KSh {med.unitPrice} (Stock: {med.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={currentItem.quantity}
              onChange={(e) => setCurrentItem((prev) => ({ ...prev, quantity: Number.parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={handleAddItem} disabled={!currentItem.medicationId}>
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium">Selected Items</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medication</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Unit Price</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.medicationName}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>KSh {item.unitPrice.toFixed(2)}</TableCell>
                  <TableCell className="font-medium">KSh {item.totalPrice.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Total Amount:
                </TableCell>
                <TableCell className="font-bold text-lg">KSh {totalAmount.toFixed(2)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      <Separator />

      {/* Payment Method */}
      <div className="space-y-2">
        <Label htmlFor="paymentMethod">Payment Method</Label>
        <Select
          value={formData.paymentMethod}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, paymentMethod: value }))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="M-Pesa">M-Pesa</SelectItem>
            <SelectItem value="Card">Card</SelectItem>
            <SelectItem value="Insurance">Insurance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={selectedItems.length === 0}>
          <Receipt className="w-4 h-4 mr-2" />
          Complete Sale
        </Button>
      </div>
    </form>
  )
}
