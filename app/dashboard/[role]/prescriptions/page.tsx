"use client"

import { useParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  ClipboardList, 
  Search, 
  Plus, 
  Eye, 
  Edit, 
  FileText, 
  User, 
  Calendar, 
  Pill,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react"
import { useState } from "react"

interface Prescription {
  id: string
  patientId: string
  patientName: string
  prescribedBy: string
  date: string
  status: "pending" | "dispensed" | "cancelled"
  medications: PrescriptionMedication[]
  notes: string
  totalAmount: number
}

interface PrescriptionMedication {
  id: string
  name: string
  dosage: string
  frequency: string
  duration: string
  quantity: number
  instructions: string
  unitPrice: number
  totalPrice: number
}

export default function PrescriptionsPage() {
  const params = useParams()
  const role = params.role as string
  const [isNewPrescriptionOpen, setIsNewPrescriptionOpen] = useState(false)
  const [isViewPrescriptionOpen, setIsViewPrescriptionOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  const mockPrescriptions: Prescription[] = [
    {
      id: "RX001",
      patientId: "P001",
      patientName: "John Doe",
      prescribedBy: "Dr. Smith",
      date: "2024-01-20",
      status: "pending",
      notes: "Take with food, complete full course",
      totalAmount: 2500,
      medications: [
        {
          id: "MED001",
          name: "Paracetamol 500mg",
          dosage: "500mg",
          frequency: "3 times daily",
          duration: "7 days",
          quantity: 21,
          instructions: "Take after meals",
          unitPrice: 5,
          totalPrice: 105
        },
        {
          id: "MED002",
          name: "Amoxicillin 250mg",
          dosage: "250mg",
          frequency: "2 times daily",
          duration: "10 days",
          quantity: 20,
          instructions: "Complete full course",
          unitPrice: 15,
          totalPrice: 300
        }
      ]
    },
    {
      id: "RX002",
      patientId: "P002",
      patientName: "Sarah Johnson",
      prescribedBy: "Dr. Brown",
      date: "2024-01-18",
      status: "dispensed",
      notes: "Regular checkup prescription",
      totalAmount: 1200,
      medications: [
        {
          id: "MED003",
          name: "Metformin 500mg",
          dosage: "500mg",
          frequency: "2 times daily",
          duration: "30 days",
          quantity: 60,
          instructions: "Take with breakfast and dinner",
          unitPrice: 8,
          totalPrice: 480
        }
      ]
    },
    {
      id: "RX003",
      patientId: "P003",
      patientName: "Michael Brown",
      prescribedBy: "Dr. Johnson",
      date: "2024-01-15",
      status: "cancelled",
      notes: "Patient allergic to medication",
      totalAmount: 800,
      medications: [
        {
          id: "MED004",
          name: "Aspirin 75mg",
          dosage: "75mg",
          frequency: "Once daily",
          duration: "30 days",
          quantity: 30,
          instructions: "Take with water",
          unitPrice: 3,
          totalPrice: 90
        }
      ]
    }
  ]

  const filteredPrescriptions = mockPrescriptions.filter(
    (rx) =>
      rx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rx.prescribedBy.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleViewPrescription = (prescription: Prescription) => {
    setSelectedPrescription(prescription)
    setIsViewPrescriptionOpen(true)
  }

  const handleNewPrescription = () => {
    setIsNewPrescriptionOpen(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500"
      case "dispensed":
        return "bg-green-500"
      case "cancelled":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return Clock
      case "dispensed":
        return CheckCircle
      case "cancelled":
        return XCircle
      default:
        return Clock
    }
  }

  const canCreatePrescriptions = role === "clinician" || role === "admin"
  const canViewPrescriptions = role === "clinician" || role === "pharmacist" || role === "admin"

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Prescriptions</h1>
            <p className="text-muted-foreground">Manage patient prescriptions and medication orders</p>
          </div>
          {canCreatePrescriptions && (
            <Button onClick={handleNewPrescription}>
              <Plus className="w-4 h-4 mr-2" />
              New Prescription
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Total Prescriptions</p>
                  <p className="text-2xl font-bold">{mockPrescriptions.length}</p>
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
                  <p className="text-2xl font-bold">
                    {mockPrescriptions.filter((rx) => rx.status === "pending").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Dispensed</p>
                  <p className="text-2xl font-bold">
                    {mockPrescriptions.filter((rx) => rx.status === "dispensed").length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Pill className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm font-medium">Total Value</p>
                  <p className="text-2xl font-bold">
                    KSh {mockPrescriptions.reduce((sum, rx) => sum + rx.totalAmount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Prescriptions</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="dispensed">Dispensed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search prescriptions..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Prescriptions</CardTitle>
                <CardDescription>
                  {filteredPrescriptions.length} of {mockPrescriptions.length} prescriptions
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
                      <TableHead>Medications</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrescriptions.map((prescription) => {
                      const StatusIcon = getStatusIcon(prescription.status)
                      return (
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
                          <TableCell>{prescription.medications.length} item(s)</TableCell>
                          <TableCell className="font-medium">KSh {prescription.totalAmount.toLocaleString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <StatusIcon className="w-4 h-4" />
                              <Badge className={getStatusColor(prescription.status)}>{prescription.status}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {canViewPrescriptions && (
                                <Button variant="ghost" size="sm" onClick={() => handleViewPrescription(prescription)}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              {canCreatePrescriptions && (
                                <Button variant="ghost" size="sm">
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            <div className="grid gap-4">
              {filteredPrescriptions
                .filter((rx) => rx.status === "pending")
                .map((prescription) => (
                  <Card key={prescription.id} className="border-yellow-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-4">
                            <Clock className="w-5 h-5 text-yellow-500" />
                            <span className="font-medium">{prescription.id}</span>
                            <Badge variant="outline">{prescription.patientName}</Badge>
                            <Badge className="bg-yellow-500">Pending</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Prescribed by {prescription.prescribedBy} • {prescription.medications.length} medications • KSh {prescription.totalAmount.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewPrescription(prescription)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          {role === "pharmacist" && (
                            <Button size="sm">
                              <Pill className="w-4 h-4 mr-2" />
                              Dispense
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="dispensed" className="space-y-4">
            <div className="grid gap-4">
              {filteredPrescriptions
                .filter((rx) => rx.status === "dispensed")
                .map((prescription) => (
                  <Card key={prescription.id} className="border-green-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-4">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <span className="font-medium">{prescription.id}</span>
                            <Badge variant="outline">{prescription.patientName}</Badge>
                            <Badge className="bg-green-500">Dispensed</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Prescribed by {prescription.prescribedBy} • {prescription.medications.length} medications • KSh {prescription.totalAmount.toLocaleString()}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleViewPrescription(prescription)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="cancelled" className="space-y-4">
            <div className="grid gap-4">
              {filteredPrescriptions
                .filter((rx) => rx.status === "cancelled")
                .map((prescription) => (
                  <Card key={prescription.id} className="border-red-200 opacity-75">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-4">
                            <XCircle className="w-5 h-5 text-red-500" />
                            <span className="font-medium">{prescription.id}</span>
                            <Badge variant="outline">{prescription.patientName}</Badge>
                            <Badge className="bg-red-500">Cancelled</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Prescribed by {prescription.prescribedBy} • {prescription.medications.length} medications • KSh {prescription.totalAmount.toLocaleString()}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleViewPrescription(prescription)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Prescription Dialog */}
      <Dialog open={isNewPrescriptionOpen} onOpenChange={setIsNewPrescriptionOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Prescription</DialogTitle>
            <DialogDescription>Prescribe medications for a patient</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Patient</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Search and select patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P001">John Doe (P001)</SelectItem>
                    <SelectItem value="P002">Sarah Johnson (P002)</SelectItem>
                    <SelectItem value="P003">Michael Brown (P003)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prescribing Doctor</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dr-smith">Dr. Smith</SelectItem>
                    <SelectItem value="dr-johnson">Dr. Johnson</SelectItem>
                    <SelectItem value="dr-brown">Dr. Brown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prescription Notes</Label>
              <Textarea placeholder="Enter prescription notes and instructions..." rows={3} />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsNewPrescriptionOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  console.log("[v0] Creating new prescription")
                  setIsNewPrescriptionOpen(false)
                }}
              >
                Create Prescription
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Prescription Dialog */}
      <Dialog open={isViewPrescriptionOpen} onOpenChange={setIsViewPrescriptionOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Prescription Details</DialogTitle>
            <DialogDescription>Complete prescription information and medication details</DialogDescription>
          </DialogHeader>
          {selectedPrescription && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Patient Information</h4>
                  <div className="space-y-2">
                    <p><strong>Name:</strong> {selectedPrescription.patientName}</p>
                    <p><strong>Patient ID:</strong> {selectedPrescription.patientId}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Prescription Details</h4>
                  <div className="space-y-2">
                    <p><strong>Prescription ID:</strong> {selectedPrescription.id}</p>
                    <p><strong>Prescribed By:</strong> {selectedPrescription.prescribedBy}</p>
                    <p><strong>Date:</strong> {new Date(selectedPrescription.date).toLocaleDateString()}</p>
                    <p><strong>Status:</strong> <Badge className={getStatusColor(selectedPrescription.status)}>{selectedPrescription.status}</Badge></p>
                  </div>
                </div>
              </div>

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
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPrescription.medications.map((med, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{med.name}</TableCell>
                        <TableCell>{med.dosage}</TableCell>
                        <TableCell>{med.frequency}</TableCell>
                        <TableCell>{med.duration}</TableCell>
                        <TableCell>{med.quantity}</TableCell>
                        <TableCell>KSh {med.unitPrice}</TableCell>
                        <TableCell className="font-medium">KSh {med.totalPrice}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>KSh {selectedPrescription.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>KSh {selectedPrescription.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {selectedPrescription.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm">{selectedPrescription.notes}</p>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline">
                  <FileText className="w-4 h-4 mr-2" />
                  Print Prescription
                </Button>
                {selectedPrescription.status === "pending" && role === "pharmacist" && (
                  <Button>
                    <Pill className="w-4 h-4 mr-2" />
                    Dispense Medication
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
