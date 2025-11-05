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
import { useState, useEffect, useMemo, useCallback } from "react"
import { prescriptionAPI, patientAPI, userAPI, pharmacyAPI } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { dashboardCache, getCacheKey, withCache } from '@/lib/dashboard-cache'
import { useDebounce } from '@/hooks/use-debounce'
import { ListSkeleton } from "@/components/ui/loading"

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

interface PrescriptionAPIResponse {
  id: string
  prescription_number?: string
  patient_id: string
  patient_name?: string
  patient_first_name?: string
  patient_last_name?: string
  doctor_name?: string
  prescribed_by?: string
  date?: string
  created_at?: string
  status: string
  medications?: PrescriptionMedication[]
  items?: PrescriptionMedication[]
  notes?: string
  instructions?: string
  total_amount?: number
  total?: number
}

interface PatientAPIResponse {
  id: string
  first_name?: string
  firstName?: string
  last_name?: string
  lastName?: string
  patient_number?: string
  patientNumber?: string
}

interface DoctorAPIResponse {
  id: string
  name?: string
  username?: string
  role: string
}

interface MedicineAPIResponse {
  id: string
  name: string
  dosage_form?: string
  strength?: string
  unit_price?: number
  unitPrice?: number
}

export default function PrescriptionsPage() {
  const params = useParams()
  const role = params.role as string
  const { toast } = useToast()
  const { user } = useAuth()
  const [isNewPrescriptionOpen, setIsNewPrescriptionOpen] = useState(false)
  const [isViewPrescriptionOpen, setIsViewPrescriptionOpen] = useState(false)
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  
  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  
  // Memoized cache key
  const prescriptionsCacheKey = useMemo(() => getCacheKey('prescriptions', { role, tab: activeTab }), [role, activeTab])
  const [patients, setPatients] = useState<Array<{id: string, firstName: string, lastName: string, patientNumber?: string}>>([])
  const [doctors, setDoctors] = useState<Array<{id: string, name: string, role: string}>>([])
  const [medicines, setMedicines] = useState<Array<{id: string, name: string, dosage_form: string, strength: string, unit_price: number}>>([])
  const [activeTab, setActiveTab] = useState("all")
  
  // Form state for new prescription
  const [selectedPatientId, setSelectedPatientId] = useState<string>("")
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("")
  const [prescriptionInstructions, setPrescriptionInstructions] = useState<string>("")
  const [selectedMedicines, setSelectedMedicines] = useState<Array<{
    medicine_id: string
    medicine_name: string
    dosage: string
    frequency: string
    duration: string
    quantity: number
    instructions: string
  }>>([])
  const [isCreating, setIsCreating] = useState(false)

  // Memoized transform function
  const transformPrescription = useCallback((p: PrescriptionAPIResponse): Prescription => ({
    id: p.id || p.prescription_number || `RX-${p.id?.slice(0, 8)}`,
    patientId: p.patient_id,
    patientName: p.patient_name || `${p.patient_first_name || ''} ${p.patient_last_name || ''}`.trim() || 'Unknown Patient',
    prescribedBy: p.doctor_name || p.prescribed_by || "Unknown Doctor",
    date: p.date || p.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    status: p.status === "active" ? "pending" as const : p.status === "dispensed" ? "dispensed" as const : p.status === "cancelled" ? "cancelled" as const : "pending" as const,
    medications: (p.medications || p.items || []).map((m: any) => ({
      id: m.id || m.medicine_id || '',
      name: m.medicine_name || m.name || '',
      dosage: m.dosage || '',
      frequency: m.frequency || '',
      duration: m.duration || m.duration_days ? `${m.duration_days} days` : '',
      quantity: m.quantity || 0,
      instructions: m.instructions || '',
      unitPrice: m.unit_price || 0,
      totalPrice: (m.quantity || 0) * (m.unit_price || 0),
    })),
    notes: p.notes || p.instructions || "",
    totalAmount: p.total_amount || p.total || 0,
  }), [])

  // Fetch prescriptions from API with caching
  useEffect(() => {
    const fetchPrescriptions = async () => {
      try {
        setLoading(true)
        const params: { page?: number; per_page?: number; status?: string } = {
          page: 1,
          per_page: 100
        }
        
        if (activeTab !== "all") {
          params.status = activeTab === "pending" ? "active" : activeTab === "dispensed" ? "dispensed" : activeTab === "cancelled" ? "cancelled" : undefined
        }

        const result = await withCache(
          prescriptionsCacheKey,
          () => prescriptionAPI.getAll(params),
          5 * 60 * 1000 // Cache for 5 minutes
        )
        
        if (result && Array.isArray(result.data)) {
          // Transform API response using memoized function
          const transformed = result.data.map(transformPrescription)
          setPrescriptions(transformed)
        }
      } catch (error) {
        console.error("Error fetching prescriptions:", error)
        toast({
          title: "Error",
          description: "Failed to load prescriptions. Please try again.",
          variant: "destructive"
        })
        // Fallback to empty array on error
        setPrescriptions([])
      } finally {
        setLoading(false)
      }
    }

    fetchPrescriptions()
  }, [activeTab, prescriptionsCacheKey, transformPrescription, toast])

  // Fetch patients for dropdown
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const result = await patientAPI.getAll()
        if (result && Array.isArray(result)) {
          setPatients(result.map((p: PatientAPIResponse) => ({
            id: p.id,
            firstName: p.first_name || p.firstName || "",
            lastName: p.last_name || p.lastName || "",
            patientNumber: p.patient_number || p.patientNumber
          })))
        }
      } catch (error) {
        console.error("Error fetching patients:", error)
      }
    }
    fetchPatients()
  }, [])

  // Fetch doctors/clinicians for prescription form
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const result = await userAPI.getAll()
        if (result && Array.isArray(result)) {
          // Filter for clinicians/doctors
          const doctorUsers = result
            .filter((u: DoctorAPIResponse) => u.role === 'clinician' || u.role === 'doctor' || u.role === 'admin')
            .map((u: DoctorAPIResponse) => ({
              id: u.id,
              name: u.name || u.username || 'Unknown',
              role: u.role
            }))
          setDoctors(doctorUsers)
          
          // Set current user as default doctor if they're a clinician
          if (user && (user.role === 'clinician' || user.role === 'doctor' || user.role === 'admin')) {
            setSelectedDoctorId(user.id)
          } else if (doctorUsers.length > 0) {
            setSelectedDoctorId(doctorUsers[0].id)
          }
        }
      } catch (error) {
        console.error("Error fetching doctors:", error)
      }
    }
    fetchDoctors()
  }, [user])

  // Fetch medicines for prescription form
  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        const result = await pharmacyAPI.getMedicines({ page: 1, per_page: 100 })
        if (result && result.data && Array.isArray(result.data)) {
          setMedicines(result.data.map((m: MedicineAPIResponse) => ({
            id: m.id,
            name: m.name || '',
            dosage_form: m.dosage_form || '',
            strength: m.strength || '',
            unit_price: m.unit_price || 0
          })))
        }
      } catch (error) {
        console.error("Error fetching medicines:", error)
      }
    }
    fetchMedicines()
  }, [])

  // Legacy mock data (kept for reference, not used)
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

  // Memoize filtered prescriptions
  const filteredPrescriptions = useMemo(() => {
    if (!debouncedSearchTerm) return prescriptions
    return prescriptions.filter(rx =>
      rx.id.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      rx.patientName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      rx.patientId.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      rx.prescribedBy.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
  }, [prescriptions, debouncedSearchTerm])

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
                  <p className="text-2xl font-bold">{loading ? "..." : prescriptions.length}</p>
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
                    {loading ? "..." : prescriptions.filter((rx) => rx.status === "pending").length}
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
                    {loading ? "..." : prescriptions.filter((rx) => rx.status === "dispensed").length}
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
                    KSh {loading ? "..." : prescriptions.reduce((sum, rx) => sum + rx.totalAmount, 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                  {loading ? "Loading..." : `${filteredPrescriptions.length} of ${prescriptions.length} prescriptions`}
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
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Loading prescriptions...
                        </TableCell>
                      </TableRow>
                    ) : filteredPrescriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No prescriptions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPrescriptions.map((prescription) => {
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
                    }))}
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
                            <Button 
                              size="sm"
                              onClick={async () => {
                                try {
                                  await prescriptionAPI.markDispensed(prescription.id, {
                                    dispensed_by: role,
                                    dispensed_at: new Date().toISOString()
                                  })
                                  toast({
                                    title: "Success",
                                    description: "Prescription dispensed successfully.",
                                  })
                                  // Refresh list
                                  window.location.reload()
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to dispense prescription.",
                                    variant: "destructive"
                                  })
                                }
                              }}
                            >
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
                <Label>Select Patient *</Label>
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Search and select patient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.firstName} {patient.lastName} {patient.patientNumber ? `(${patient.patientNumber})` : `(${patient.id.slice(0, 8)})`}
                      </SelectItem>
                    ))}
                    {patients.length === 0 && (
                      <SelectItem value="" disabled>No patients available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prescribing Doctor *</Label>
                <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} ({doctor.role})
                      </SelectItem>
                    ))}
                    {doctors.length === 0 && (
                      <SelectItem value="" disabled>No doctors available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Medicines Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Medications *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedMedicines([...selectedMedicines, {
                      medicine_id: '',
                      medicine_name: '',
                      dosage: '',
                      frequency: '',
                      duration: '',
                      quantity: 1,
                      instructions: ''
                    }])
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Medication
                </Button>
              </div>
              {selectedMedicines.map((med, index) => (
                <div key={index} className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label>Medicine</Label>
                    <Select
                      value={med.medicine_id}
                      onValueChange={(value) => {
                        const selectedMed = medicines.find(m => m.id === value)
                        const updated = [...selectedMedicines]
                        updated[index] = {
                          ...updated[index],
                          medicine_id: value,
                          medicine_name: selectedMed?.name || ''
                        }
                        setSelectedMedicines(updated)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select medicine..." />
                      </SelectTrigger>
                      <SelectContent>
                        {medicines.map((medicine) => (
                          <SelectItem key={medicine.id} value={medicine.id}>
                            {medicine.name} ({medicine.strength} {medicine.dosage_form})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min="1"
                      value={med.quantity}
                      onChange={(e) => {
                        const updated = [...selectedMedicines]
                        updated[index].quantity = parseInt(e.target.value) || 1
                        setSelectedMedicines(updated)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dosage</Label>
                    <Input
                      placeholder="e.g., 500mg"
                      value={med.dosage}
                      onChange={(e) => {
                        const updated = [...selectedMedicines]
                        updated[index].dosage = e.target.value
                        setSelectedMedicines(updated)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Input
                      placeholder="e.g., 2 times daily"
                      value={med.frequency}
                      onChange={(e) => {
                        const updated = [...selectedMedicines]
                        updated[index].frequency = e.target.value
                        setSelectedMedicines(updated)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input
                      placeholder="e.g., 7 days"
                      value={med.duration}
                      onChange={(e) => {
                        const updated = [...selectedMedicines]
                        updated[index].duration = e.target.value
                        setSelectedMedicines(updated)
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Instructions</Label>
                    <Input
                      placeholder="e.g., Take after meals"
                      value={med.instructions}
                      onChange={(e) => {
                        const updated = [...selectedMedicines]
                        updated[index].instructions = e.target.value
                        setSelectedMedicines(updated)
                      }}
                    />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedMedicines(selectedMedicines.filter((_, i) => i !== index))
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {selectedMedicines.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Click "Add Medication" to add medications to this prescription
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Prescription Instructions/Notes *</Label>
              <Textarea
                placeholder="Enter prescription notes and instructions..."
                rows={3}
                value={prescriptionInstructions}
                onChange={(e) => setPrescriptionInstructions(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsNewPrescriptionOpen(false)
                  setSelectedPatientId("")
                  setSelectedDoctorId(user && (user.role === 'clinician' || user.role === 'doctor' || user.role === 'admin') ? user.id : "")
                  setPrescriptionInstructions("")
                  setSelectedMedicines([])
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  // Validation
                  if (!selectedPatientId) {
                    toast({
                      title: "Validation Error",
                      description: "Please select a patient",
                      variant: "destructive"
                    })
                    return
                  }
                  if (!selectedDoctorId) {
                    toast({
                      title: "Validation Error",
                      description: "Please select a doctor",
                      variant: "destructive"
                    })
                    return
                  }
                  if (selectedMedicines.length === 0) {
                    toast({
                      title: "Validation Error",
                      description: "Please add at least one medication",
                      variant: "destructive"
                    })
                    return
                  }
                  if (!prescriptionInstructions.trim()) {
                    toast({
                      title: "Validation Error",
                      description: "Please enter prescription instructions",
                      variant: "destructive"
                    })
                    return
                  }

                  try {
                    setIsCreating(true)
                    
                    // Prepare medicines array for backend
                    const medicinesArray = selectedMedicines.map(med => ({
                      medicine_id: med.medicine_id,
                      medicine_name: med.medicine_name,
                      dosage: med.dosage,
                      frequency: med.frequency,
                      duration: med.duration,
                      quantity: med.quantity,
                      instructions: med.instructions
                    }))
                    
                    const prescriptionData = {
                      patient_id: selectedPatientId,
                      doctor_id: selectedDoctorId,
                      medicines: medicinesArray,
                      instructions: prescriptionInstructions,
                      status: "active"
                    }

                    const result = await prescriptionAPI.create(prescriptionData)
                    
                    if (result) {
                      toast({
                        title: "Success",
                        description: "Prescription created successfully",
                      })
                      
                      // Reset form
                      setSelectedPatientId("")
                      setSelectedDoctorId(user && (user.role === 'clinician' || user.role === 'doctor' || user.role === 'admin') ? user.id : "")
                      setPrescriptionInstructions("")
                      setSelectedMedicines([])
                      setIsNewPrescriptionOpen(false)
                      
                      // Refresh prescriptions list
                      window.location.reload()
                    }
                  } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : "Failed to create prescription. Please try again."
                    toast({
                      title: "Error",
                      description: errorMessage,
                      variant: "destructive"
                    })
                  } finally {
                    setIsCreating(false)
                  }
                }}
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create Prescription"}
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
                  <Button
                    onClick={async () => {
                      try {
                        await prescriptionAPI.markDispensed(selectedPrescription.id, {
                          dispensed_by: role,
                          dispensed_at: new Date().toISOString()
                        })
                        toast({
                          title: "Success",
                          description: "Prescription dispensed successfully.",
                        })
                        setIsViewPrescriptionOpen(false)
                        // Refresh prescriptions list
                        window.location.reload()
                      } catch (error) {
                        toast({
                          title: "Error",
                          description: "Failed to dispense prescription. Please try again.",
                          variant: "destructive"
                        })
                      }
                    }}
                  >
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
