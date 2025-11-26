"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import { patientAPI } from "@/lib/api-client"
import { dashboardCache, getCacheKey, withCache } from '@/lib/dashboard-cache'
import { useDebounce } from '@/hooks/use-debounce'
import { useToast } from "@/hooks/use-toast"
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from '@/hooks/use-keyboard-shortcuts'
import { Skeleton, PatientListSkeleton } from "@/components/ui/loading"
import { Pagination } from "@/components/ui/pagination"
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
import {
  Search,
  UserPlus,
  Edit,
  Eye,
  Phone,
  MapPin,
  Calendar,
  User,
  Heart,
  AlertCircle,
  FileText,
  RefreshCw,
} from "lucide-react"

interface PatientManagementProps {
  role: string
}

interface Patient {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  phone: string
  location: string
  emergencyContact: string
  emergencyPhone: string
  bloodType: string
  allergies: string[]
  medicalHistory: string
  registrationDate: string
  lastVisit: string
  status: "Active" | "Inactive"
}

const mockPatients: Patient[] = [
  {
    id: "P001",
    firstName: "John",
    lastName: "Doe",
    dateOfBirth: "1985-03-15",
    gender: "Male",
    phone: "+1 (555) 123-4567",
    location: "123 Main St, Anytown, ST 12345",
    emergencyContact: "Jane Doe",
    emergencyPhone: "+1 (555) 987-6543",
    bloodType: "O+",
    allergies: ["Penicillin", "Peanuts"],
    medicalHistory: "Hypertension, managed with medication",
    registrationDate: "2023-01-15",
    lastVisit: "2024-01-20",
    status: "Active",
  },
  {
    id: "P002",
    firstName: "Sarah",
    lastName: "Johnson",
    dateOfBirth: "1992-07-22",
    gender: "Female",
    phone: "+1 (555) 234-5678",
    location: "456 Oak Ave, Somewhere, ST 67890",
    emergencyContact: "Mike Johnson",
    emergencyPhone: "+1 (555) 876-5432",
    bloodType: "A-",
    allergies: ["Shellfish"],
    medicalHistory: "No significant medical history",
    registrationDate: "2023-03-10",
    lastVisit: "2024-01-18",
    status: "Active",
  },
  {
    id: "P003",
    firstName: "Michael",
    lastName: "Brown",
    dateOfBirth: "1978-11-08",
    gender: "Male",
    phone: "+1 (555) 345-6789",
    location: "789 Pine Rd, Elsewhere, ST 13579",
    emergencyContact: "Lisa Brown",
    emergencyPhone: "+1 (555) 765-4321",
    bloodType: "B+",
    allergies: [],
    medicalHistory: "Diabetes Type 2, regular monitoring required",
    registrationDate: "2022-11-20",
    lastVisit: "2024-01-15",
    status: "Active",
  },
]

export function PatientManagement({ role }: PatientManagementProps) {
  const { toast } = useToast()
  const [patients, setPatients] = useState<Patient[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false)
  const [isViewPatientOpen, setIsViewPatientOpen] = useState(false)
  const [isEditPatientOpen, setIsEditPatientOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Debounce search term to reduce API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Memoized cache key for patient data
  const patientsCacheKey = useMemo(
    () => getCacheKey('patients', { page, search: debouncedSearchTerm, role }),
    [page, debouncedSearchTerm, role]
  )

  // Transform API response to Patient interface (memoized)
  const transformPatient = useCallback((p: any): Patient => ({
    id: p.id || p.patient_number || `P-${p.id?.slice(0, 8)}`,
    firstName: p.first_name || p.firstName || '',
    lastName: p.last_name || p.lastName || '',
    dateOfBirth: p.date_of_birth || p.dateOfBirth || '',
    gender: p.gender || 'Unknown',
    phone: p.phone_number || p.phone || '',
    location: p.address || p.location || '',
    emergencyContact: p.emergency_contact_name || p.emergencyContact || '',
    emergencyPhone: p.emergency_contact_phone || p.emergencyPhone || '',
    bloodType: p.blood_type || p.bloodType || 'Unknown',
    allergies: Array.isArray(p.allergies) ? p.allergies : 
              (p.allergies ? p.allergies.split(',').map((a: string) => a.trim()) : []),
    medicalHistory: p.medical_history || p.medicalHistory || '',
    registrationDate: p.registration_date || p.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    lastVisit: p.last_visit || p.lastVisit || p.registration_date || new Date().toISOString().split('T')[0],
    status: (p.status === 'active' || p.status === 'Active') ? 'Active' as const : 'Inactive' as const,
  }), [])

  // Fetch patients from API with caching and debounced search
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true)
        
        // Use cached API call if available
        const cacheKey = patientsCacheKey
        let result: any
        
        if (debouncedSearchTerm) {
          // Use search API if search term exists
          try {
            result = await withCache(
              cacheKey,
              () => patientAPI.search(debouncedSearchTerm),
              2 * 60 * 1000 // Cache search results for 2 minutes
            )
            // Transform search results
            if (result && Array.isArray(result)) {
              const transformed = result.map(transformPatient)
              setPatients(transformed)
              setTotalPages(1) // Search results typically don't have pagination
              return
            }
          } catch (searchError) {
            console.warn("Search API failed, falling back to getAll:", searchError)
          }
        }
        
        // Fallback to getAll with pagination
        result = await withCache(
          cacheKey,
          () => patientAPI.getAll({ page, per_page: 50 }),
          5 * 60 * 1000 // Cache for 5 minutes
        )
        
        if (result && Array.isArray(result.data)) {
          // Transform API response to match Patient interface
          const transformed = result.data.map(transformPatient)
          setPatients(transformed)

          if (result.pagination) {
            setTotalPages(result.pagination.total_pages || 1)
          }
        } else if (result && Array.isArray(result)) {
          // Handle case where API returns array directly
          const transformed = result.map(transformPatient)
          setPatients(transformed)
          setTotalPages(1)
        } else {
          // Fallback to mock data if API returns unexpected format
          setPatients(mockPatients)
          toast({
            title: "Info",
            description: "Using sample data. Patient API may not be available.",
            variant: "default"
          })
        }
      } catch (error) {
        console.error("Error fetching patients:", error)
        toast({
          title: "Error",
          description: "Failed to load patients. Using sample data.",
          variant: "destructive"
        })
        // Fallback to mock data on error
        setPatients(mockPatients)
      } finally {
        setLoading(false)
      }
    }

    fetchPatients()
  }, [page, debouncedSearchTerm, patientsCacheKey, transformPatient, toast])

  // Memoize filtered patients (only needed if search is client-side)
  // If using API search, this will just return patients as-is
  const filteredPatients = useMemo(() => {
    // If we have a search term, API search should handle it
    // But keep client-side filtering as fallback for immediate feedback
    if (!searchTerm || debouncedSearchTerm !== searchTerm) {
      // Show all patients while user is typing (before debounce)
      return patients
    }
    
    // After debounce, if API search was used, return patients as-is
    // Otherwise, apply client-side filter
    if (debouncedSearchTerm) {
      return patients.filter(
        (patient) =>
          patient.firstName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          patient.lastName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          patient.id.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          patient.phone.includes(debouncedSearchTerm) ||
          patient.location.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
      )
    }
    
    return patients
  }, [patients, searchTerm, debouncedSearchTerm])

  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true)
      // Invalidate cache before refreshing
      dashboardCache.invalidate(patientsCacheKey)
      dashboardCache.invalidatePattern('dashboard:patients:.*')
      
      const result = await patientAPI.getAll({ page, per_page: 50 })

      if (result && Array.isArray(result.data)) {
        const transformed = result.data.map(transformPatient)
        setPatients(transformed)

        if (result.pagination) {
          setTotalPages(result.pagination.total_pages || 1)
        }
      } else if (result && Array.isArray(result)) {
        const transformed = result.map(transformPatient)
        setPatients(transformed)
        setTotalPages(1)
      }

      toast({
        title: "Refreshed",
        description: "Patient data has been refreshed.",
      })
    } catch (error) {
      console.error("Error refreshing patients:", error)
      toast({
        title: "Error",
        description: "Failed to refresh patients.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [page, patientsCacheKey, transformPatient, toast])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: true,
    shortcuts: [
      {
        ...COMMON_SHORTCUTS.NEW,
        handler: () => {
          if (canRegisterPatients) {
            setIsNewPatientOpen(true)
          }
        },
      },
      {
        ...COMMON_SHORTCUTS.REFRESH,
        handler: () => handleRefresh(),
      },
      {
        ...COMMON_SHORTCUTS.SEARCH,
        handler: () => {
          // Focus search input
          const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement
          searchInput?.focus()
        },
      },
      {
        key: 'Escape',
        handler: () => {
          setIsNewPatientOpen(false)
          setIsEditPatientOpen(false)
          setIsViewPatientOpen(false)
        },
      },
    ],
  })

  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setIsViewPatientOpen(true)
  }

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setIsEditPatientOpen(true)
  }

  const canRegisterPatients = role === "receptionist" || role === "admin"
  const canViewFullDetails = role === "clinician" || role === "admin"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-balance">Patient Management</h1>
          <p className="text-muted-foreground">Manage patient records and registrations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canRegisterPatients && (
            <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <UserPlus className="w-4 h-4" />
                  <span>Register New Patient</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Register New Patient</DialogTitle>
                  <DialogDescription>Enter patient information to create a new record</DialogDescription>
                </DialogHeader>
                <NewPatientForm onClose={() => setIsNewPatientOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search and Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search patients by name, ID, phone, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Total Patients</p>
                <p className="text-2xl font-bold">{patients.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Heart className="w-5 h-5 text-accent" />
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-2xl font-bold">{patients.filter((p) => p.status === "Active").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patient List */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Records</CardTitle>
          <CardDescription>
            {filteredPatients.length} of {patients.length} patients
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Last Visit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading patients...
                  </TableCell>
                </TableRow>
              ) : filteredPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No patients found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">{patient.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {patient.firstName} {patient.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{patient.gender}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1">
                        <Phone className="w-3 h-3" />
                        <span className="text-sm">{patient.phone}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span className="text-sm">{patient.location}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(patient.lastVisit).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={patient.status === "Active" ? "default" : "secondary"}>{patient.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleViewPatient(patient)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {canRegisterPatients && (
                        <Button variant="ghost" size="sm" onClick={() => handleEditPatient(patient)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Patient Details Dialog */}
      <Dialog open={isViewPatientOpen} onOpenChange={setIsViewPatientOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>Complete patient information and medical history</DialogDescription>
          </DialogHeader>
          {selectedPatient && <PatientDetailsView patient={selectedPatient} canViewFull={canViewFullDetails} />}
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={isEditPatientOpen} onOpenChange={setIsEditPatientOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient</DialogTitle>
            <DialogDescription>Update patient information</DialogDescription>
          </DialogHeader>
          {selectedPatient && <EditPatientForm patient={selectedPatient} onClose={() => setIsEditPatientOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NewPatientForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    age: "", // Using age instead of dateOfBirth for simplicity
    gender: "",
    phone: "",
    location: "",
    emergencyContact: "",
    emergencyPhone: "",
    bloodType: "",
    allergies: "",
    medicalHistory: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Validate form data
      const validation = validateForm(formData, validationSchemas.patient)
      
      if (!validation.isValid) {
        // Show validation errors
        console.error("Validation errors:", validation.errors)
        return
      }
      
      // Generate patient ID
      const patientId = `P${String(Date.now()).slice(-6)}`
      
      // Create new patient object
      const newPatient = {
        id: patientId,
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      // Create patient via API
      try {
        // Send age directly, no conversion needed
        const patientData = {
          first_name: formData.firstName,
          last_name: formData.lastName,
          age: formData.age ? Number(formData.age) : undefined,
          gender: formData.gender,
          phone_number: formData.phone,
          address: formData.location,
          emergency_contact_name: formData.emergencyContact,
          emergency_contact_phone: formData.emergencyPhone,
          blood_type: formData.bloodType || null,
          allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()) : [],
          medical_history: formData.medicalHistory || null,
        }

        await patientAPI.create(patientData)
        
        // Invalidate patient cache after creating new patient
        dashboardCache.invalidatePattern('dashboard:patients:.*')
        
        toast({
          title: "Patient Registered",
          description: "Patient has been registered successfully.",
        })
        
        // Close form on success
        onClose()
        
        // Refresh patients list
        window.location.reload()
      } catch (error) {
        console.error("Error creating patient:", error)
        toast({
          title: "Error",
          description: "Failed to register patient. Please try again.",
          variant: "destructive"
        })
      }
      
    } catch (error) {
      console.error("Error creating patient:", error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="contact">Contact Details</TabsTrigger>
          <TabsTrigger value="medical">Medical Info</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age (years)</Label>
              <Input
                id="age"
                type="number"
                min="0"
                max="150"
                placeholder="Enter age"
                value={formData.age}
                onChange={(e) => setFormData((prev) => ({ ...prev, age: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Date of birth will be calculated automatically</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Textarea
              id="location"
              value={formData.location}
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => setFormData((prev) => ({ ...prev, emergencyContact: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">Emergency Phone</Label>
              <Input
                id="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, emergencyPhone: e.target.value }))}
                required
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="medical" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bloodType">Blood Type</Label>
            <Select
              value={formData.bloodType}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, bloodType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select blood type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A+">A+</SelectItem>
                <SelectItem value="A-">A-</SelectItem>
                <SelectItem value="B+">B+</SelectItem>
                <SelectItem value="B-">B-</SelectItem>
                <SelectItem value="AB+">AB+</SelectItem>
                <SelectItem value="AB-">AB-</SelectItem>
                <SelectItem value="O+">O+</SelectItem>
                <SelectItem value="O-">O-</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="allergies">Allergies (comma-separated)</Label>
            <Input
              id="allergies"
              value={formData.allergies}
              onChange={(e) => setFormData((prev) => ({ ...prev, allergies: e.target.value }))}
              placeholder="e.g., Penicillin, Peanuts, Shellfish"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medicalHistory">Medical History</Label>
            <Textarea
              id="medicalHistory"
              value={formData.medicalHistory}
              onChange={(e) => setFormData((prev) => ({ ...prev, medicalHistory: e.target.value }))}
              rows={4}
              placeholder="Enter relevant medical history..."
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Register Patient</Button>
      </div>
    </form>
  )
}

function PatientDetailsView({ patient, canViewFull }: { patient: Patient; canViewFull: boolean }) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contact">Contact Info</TabsTrigger>
          {canViewFull && <TabsTrigger value="medical">Medical Details</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <User className="w-8 h-8 text-primary" />
                  <div>
                    <h3 className="font-semibold">
                      {patient.firstName} {patient.lastName}
                    </h3>
                    <p className="text-sm text-muted-foreground">Patient ID: {patient.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-8 h-8 text-accent" />
                  <div>
                    <h3 className="font-semibold">Age & Gender</h3>
                    <p className="text-sm text-muted-foreground">
                      {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years, {patient.gender}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Registration Date</Label>
              <p className="text-sm">{new Date(patient.registrationDate).toLocaleDateString()}</p>
            </div>
            <div className="space-y-2">
              <Label>Last Visit</Label>
              <p className="text-sm">{new Date(patient.lastVisit).toLocaleDateString()}</p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Badge variant={patient.status === "Active" ? "default" : "secondary"}>{patient.status}</Badge>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-center space-x-3">
              <Phone className="w-5 h-5 text-primary" />
              <div>
                <Label>Phone Number</Label>
                <p className="text-sm">{patient.phone}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-primary" />
              <div>
                <Label>Location</Label>
                <p className="text-sm">{patient.location}</p>
              </div>
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Emergency Contact</h4>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Name:</strong> {patient.emergencyContact}
                </p>
                <p className="text-sm">
                  <strong>Phone:</strong> {patient.emergencyPhone}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {canViewFull && (
          <TabsContent value="medical" className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center space-x-3">
                <Heart className="w-5 h-5 text-destructive" />
                <div>
                  <Label>Blood Type</Label>
                  <p className="text-sm font-medium">{patient.bloodType}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-accent mt-1" />
                <div className="flex-1">
                  <Label>Allergies</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {patient.allergies.length > 0 ? (
                      patient.allergies.map((allergy, index) => (
                        <Badge key={index} variant="destructive">
                          {allergy}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No known allergies</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FileText className="w-5 h-5 text-primary mt-1" />
                <div className="flex-1">
                  <Label>Medical History</Label>
                  <p className="text-sm mt-1">{patient.medicalHistory || "No significant medical history"}</p>
                </div>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function EditPatientForm({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const { toast } = useToast()
  
  // Use age from patient if available, otherwise calculate from dateOfBirth
  const getAge = (patient: Patient): string => {
    if ((patient as any).age !== undefined) {
      return (patient as any).age.toString()
    }
    if (patient.dateOfBirth) {
      const birthDate = new Date(patient.dateOfBirth)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      return age.toString()
    }
    return ''
  }
  
  const [formData, setFormData] = useState({
    firstName: patient.firstName,
    lastName: patient.lastName,
    age: getAge(patient), // Use age directly or calculated from dateOfBirth
    gender: patient.gender,
    phone: patient.phone,
    location: patient.location,
    emergencyContact: patient.emergencyContact,
    emergencyPhone: patient.emergencyPhone,
    bloodType: patient.bloodType,
    allergies: patient.allergies.join(", "),
    medicalHistory: patient.medicalHistory,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Validate form data
      const validation = validateForm(formData, validationSchemas.patient)
      
      if (!validation.isValid) {
        console.error("Validation errors:", validation.errors)
        toast({
          title: "Validation Error",
          description: "Please check all required fields.",
          variant: "destructive"
        })
        return
      }

      // Send age directly, no conversion needed
      // Update patient via API
      const patientData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        age: formData.age ? Number(formData.age) : undefined,
        gender: formData.gender,
        phone_number: formData.phone,
        address: formData.location,
        emergency_contact_name: formData.emergencyContact,
        emergency_contact_phone: formData.emergencyPhone,
        blood_type: formData.bloodType || null,
        allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()) : [],
        medical_history: formData.medicalHistory || null,
      }

      // Optimistic update: Update patient in list immediately
      const originalPatient = patients.find(p => p.id === patient.id)
      if (originalPatient) {
        const optimisticUpdate: Patient = {
          ...originalPatient,
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: patient.dateOfBirth, // Keep existing dateOfBirth for display
          gender: formData.gender as 'Male' | 'Female' | 'Other',
          phone: formData.phone,
          location: formData.location,
          emergencyContact: formData.emergencyContact,
          emergencyPhone: formData.emergencyPhone,
          bloodType: formData.bloodType || 'Unknown',
          allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()) : [],
          medicalHistory: formData.medicalHistory || '',
        }
        
        // Update optimistically
        setPatients(prev => prev.map(p => 
          p.id === patient.id ? optimisticUpdate : p
        ))
      }
      
      try {
        const result = await patientAPI.update(patient.id, patientData)
        
        // Replace with real updated data
        if (result) {
          setPatients(prev => prev.map(p => 
            p.id === patient.id ? transformPatient(result) : p
          ))
        }
        
        // Invalidate patient cache after updating
        dashboardCache.invalidatePattern('dashboard:patients:.*')
        
        toast({
          title: "Patient Updated",
          description: "Patient information has been updated successfully.",
        })
        
        // Close form on success
        onClose()
      } catch (error) {
        // Revert optimistic update on error
        if (originalPatient) {
          setPatients(prev => prev.map(p => 
            p.id === patient.id ? originalPatient : p
          ))
        }
        
        console.error("Error updating patient:", error)
        toast({
          title: "Error",
          description: "Failed to update patient. Please try again.",
          variant: "destructive"
        })
        throw error
      }
    } catch (error) {
      console.error("Error updating patient:", error)
      toast({
        title: "Error",
        description: "Failed to update patient. Please try again.",
        variant: "destructive"
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="contact">Contact Details</TabsTrigger>
          <TabsTrigger value="medical">Medical Info</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Age (years)</Label>
              <Input
                id="age"
                type="number"
                min="0"
                max="150"
                placeholder="Enter age"
                value={formData.age}
                onChange={(e) => setFormData((prev) => ({ ...prev, age: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Date of birth will be calculated automatically</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, gender: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Textarea
              id="location"
              value={formData.location}
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => setFormData((prev) => ({ ...prev, emergencyContact: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">Emergency Phone</Label>
              <Input
                id="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, emergencyPhone: e.target.value }))}
                required
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="medical" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bloodType">Blood Type</Label>
            <Select
              value={formData.bloodType}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, bloodType: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select blood type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A+">A+</SelectItem>
                <SelectItem value="A-">A-</SelectItem>
                <SelectItem value="B+">B+</SelectItem>
                <SelectItem value="B-">B-</SelectItem>
                <SelectItem value="AB+">AB+</SelectItem>
                <SelectItem value="AB-">AB-</SelectItem>
                <SelectItem value="O+">O+</SelectItem>
                <SelectItem value="O-">O-</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="allergies">Allergies (comma-separated)</Label>
            <Input
              id="allergies"
              value={formData.allergies}
              onChange={(e) => setFormData((prev) => ({ ...prev, allergies: e.target.value }))}
              placeholder="e.g., Penicillin, Peanuts, Shellfish"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medicalHistory">Medical History</Label>
            <Textarea
              id="medicalHistory"
              value={formData.medicalHistory}
              onChange={(e) => setFormData((prev) => ({ ...prev, medicalHistory: e.target.value }))}
              rows={4}
              placeholder="Enter relevant medical history..."
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  )
}
