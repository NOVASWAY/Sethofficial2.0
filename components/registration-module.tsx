'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UserPlus, Search, FileText, Calendar, Phone, Mail, MapPin, Heart, AlertCircle, CheckCircle2, Eye, Edit, Users, Activity } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { PatientImport } from './patient-import'
import { MigrationWizard } from './migration-wizard'
import { ImportProgressDashboard } from './import-progress-dashboard'
import { usePatientEnhanced, type Patient } from '@/contexts/patient-context-enhanced'
import { DateRangeFilter, type DateRange, isDateInRange } from '@/components/date-range-filter'
import { validatePhoneNumber } from '@/lib/import-validation'
import { isPhoneMatch, isNameSimilar, normalizePhone } from '@/lib/duplicate-detection'
import { consultationAPI, invoiceAPI, prescriptionAPI, activityLogAPI } from '@/lib/api-client'
import { Receipt, Stethoscope, Pill, Calendar as CalendarIcon, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

// Common Kenyan locations for autocomplete
const KENYAN_LOCATIONS = [
  'Nairobi', 'Kiambu', 'Nakuru', 'Mombasa', 'Kisumu', 'Eldoret', 'Thika', 'Nyeri',
  'Meru', 'Machakos', 'Kakamega', 'Bungoma', 'Embu', 'Isiolo', 'Garissa', 'Wajir',
  'Kericho', 'Bomet', 'Narok', 'Kajiado', 'Kitui', 'Makueni', 'Taita Taveta',
  'Kilifi', 'Kwale', 'Lamu', 'Tana River', 'Marsabit', 'Mandera', 'Turkana',
  'West Pokot', 'Samburu', 'Trans Nzoia', 'Uasin Gishu', 'Elgeyo Marakwet',
  'Nandi', 'Baringo', 'Laikipia', 'Nyandarua', 'Murang\'a', 'Kirinyaga',
  'Nyamira', 'Kisii', 'Homa Bay', 'Migori', 'Siaya', 'Busia', 'Vihiga'
]

// Visit reason categories
export type VisitReasonCategory = 'follow-up' | 'new-complaint' | 'routine-check' | 'emergency' | 'medication-refill' | 'lab-results' | 'other'

export const VISIT_REASON_CATEGORIES: { value: VisitReasonCategory; label: string; description: string }[] = [
  { value: 'follow-up', label: 'Follow-up', description: 'Follow-up visit for previous condition' },
  { value: 'new-complaint', label: 'New Complaint', description: 'New medical complaint or symptom' },
  { value: 'routine-check', label: 'Routine Check', description: 'Regular health check-up' },
  { value: 'emergency', label: 'Emergency', description: 'Urgent medical attention needed' },
  { value: 'medication-refill', label: 'Medication Refill', description: 'Need to refill prescription' },
  { value: 'lab-results', label: 'Lab Results', description: 'Review of laboratory test results' },
  { value: 'other', label: 'Other', description: 'Other reason not listed' }
]

// Helper function to categorize visit reason
export const categorizeVisitReason = (reason: string): VisitReasonCategory => {
  const lowerReason = reason.toLowerCase()
  
  if (lowerReason.includes('follow') || lowerReason.includes('review') || lowerReason.includes('recheck')) {
    return 'follow-up'
  }
  if (lowerReason.includes('emergency') || lowerReason.includes('urgent') || lowerReason.includes('acute')) {
    return 'emergency'
  }
  if (lowerReason.includes('routine') || lowerReason.includes('check') || lowerReason.includes('screening')) {
    return 'routine-check'
  }
  if (lowerReason.includes('refill') || lowerReason.includes('medication') || lowerReason.includes('prescription')) {
    return 'medication-refill'
  }
  if (lowerReason.includes('lab') || lowerReason.includes('test') || lowerReason.includes('result')) {
    return 'lab-results'
  }
  if (lowerReason.length > 0) {
    return 'new-complaint'
  }
  
  return 'other'
}

// Mock patients are now loaded from context - no longer needed here
// Context will load from localStorage or start empty

export function RegistrationModule() {
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useAuth()
  const { patients, addPatient, updatePatient, searchPatients, getTotalPatients, getActivePatients } = usePatientEnhanced()
  const [activeTab, setActiveTab] = useState('records')
  const [loading, setLoading] = useState(false)
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([])
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  
  // Sync context patients to local state with filtering
  useEffect(() => {
    const patientsArray = Array.isArray(patients) ? patients : []
    let filtered = patientsArray

    // Apply search filter
    if (searchFilter) {
      filtered = filtered.filter(patient => 
        patient.first_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        patient.last_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        patient.phone.includes(searchFilter) ||
        patient.patient_number.toLowerCase().includes(searchFilter.toLowerCase())
      )
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(patient => 
        isDateInRange(patient.created_at, dateRange)
      )
    }

    setFilteredPatients(filtered)
  }, [patients, searchFilter, dateRange])
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    gender: '',
    phone: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    visit_reason: '', // New field for visit reason
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [returningPatient, setReturningPatient] = useState<Patient | null>(null)
  const [phoneValidationError, setPhoneValidationError] = useState<string>('')
  const [duplicateWarning, setDuplicateWarning] = useState<{
    show: boolean
    matches: Patient[]
  }>({ show: false, matches: [] })
  const [patientConsultations, setPatientConsultations] = useState<any[]>([])
  const [patientInvoices, setPatientInvoices] = useState<any[]>([])
  const [patientPrescriptions, setPatientPrescriptions] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([])
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [quickRegistrationMode, setQuickRegistrationMode] = useState(false)
  const [visitReasonCategory, setVisitReasonCategory] = useState<VisitReasonCategory | ''>('')

  // Auto-detect returning patient when phone number is entered
  useEffect(() => {
    const checkReturningPatient = async () => {
      if (formData.phone.length >= 10) {
        try {
          const results = await searchPatients(formData.phone)
          if (results.length > 0) {
            const match = results[0]
            setReturningPatient(match)
            // Pre-fill form with existing data
            setFormData(prev => ({
              ...prev,
              first_name: match.first_name,
              last_name: match.last_name,
              date_of_birth: match.date_of_birth,
              gender: match.gender,
              address: match.address || prev.address,
              emergency_contact: match.emergency_contact || prev.emergency_contact,
              emergency_phone: match.emergency_phone || prev.emergency_phone,
            }))
            toast({
              title: 'Returning Patient Detected',
              description: `Found existing patient: ${match.first_name} ${match.last_name} (${match.patient_number})`,
            })
          } else {
            setReturningPatient(null)
          }
        } catch (error) {
          // Silently fail - don't show error for search
          setReturningPatient(null)
        }
      } else {
        setReturningPatient(null)
      }
    }

    const timeoutId = setTimeout(checkReturningPatient, 500) // Debounce
    return () => clearTimeout(timeoutId)
  }, [formData.phone, searchPatients, toast])

  // Validate phone number format
  useEffect(() => {
    if (formData.phone && formData.phone.length > 0) {
      const validation = validatePhoneNumber(formData.phone, 'kenya')
      if (validation) {
        setPhoneValidationError(validation.message)
      } else {
        setPhoneValidationError('')
      }
    } else {
      setPhoneValidationError('')
    }
  }, [formData.phone])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    // Auto-format phone number
    if (name === 'phone' || name === 'emergency_phone') {
      let formatted = value.replace(/\D/g, '') // Remove non-digits
      if (formatted.startsWith('254')) {
        formatted = '+' + formatted
      } else if (formatted.startsWith('0') && formatted.length > 1) {
        formatted = '+254' + formatted.substring(1)
      } else if (formatted.length === 9) {
        formatted = '+254' + formatted
      }
      setFormData(prev => ({ ...prev, [name]: formatted }))
    } else if (name === 'address') {
      // Location autocomplete
      setFormData(prev => ({ ...prev, [name]: value }))
      if (value.length > 0) {
        const filtered = KENYAN_LOCATIONS.filter(loc => 
          loc.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 5)
        setLocationSuggestions(filtered)
        setShowLocationSuggestions(filtered.length > 0)
      } else {
        setLocationSuggestions([])
        setShowLocationSuggestions(false)
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleLocationSelect = (location: string) => {
    setFormData(prev => ({ ...prev, address: location }))
    setShowLocationSuggestions(false)
    setLocationSuggestions([])
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const generatePatientNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `PAT-${year}-${random}`
  }

  // Check for duplicates before registration
  const checkForDuplicates = async (patientData: typeof formData): Promise<Patient[]> => {
    const patientsArray = Array.isArray(patients) ? patients : []
    const matches: Patient[] = []

    for (const existing of patientsArray) {
      let isMatch = false

      // Check phone match
      if (patientData.phone && existing.phone) {
        if (isPhoneMatch(patientData.phone, existing.phone)) {
          isMatch = true
        }
      }

      // Check name match
      if (patientData.first_name && patientData.last_name && existing.first_name && existing.last_name) {
        const fullName = `${patientData.first_name} ${patientData.last_name}`
        const existingFullName = `${existing.first_name} ${existing.last_name}`
        if (isNameSimilar(fullName, existingFullName, 0.85)) {
          isMatch = true
        }
      }

      if (isMatch && !matches.find(m => m.id === existing.id)) {
        matches.push(existing)
      }
    }

    return matches
  }

  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate required fields based on mode
      if (quickRegistrationMode && returningPatient) {
        // Quick mode: only phone and visit reason required
        if (!formData.phone || !formData.visit_reason) {
          toast({
            variant: 'error',
            title: 'Validation Error',
            description: 'Phone number and visit reason are required for quick registration',
          })
          setLoading(false)
          return
        }
      } else {
        // Full mode: standard validation (emergency contact is optional)
        if (!formData.first_name || !formData.last_name || !formData.date_of_birth || 
            !formData.gender || !formData.phone || !formData.address) {
          toast({
            variant: 'error',
            title: 'Validation Error',
            description: 'Please fill in all required fields (emergency contact is optional)',
          })
          setLoading(false)
          return
        }
      }

      // Validate phone number format
      const phoneValidation = validatePhoneNumber(formData.phone, 'kenya')
      if (phoneValidation && phoneValidation.severity === 'error') {
        toast({
          variant: 'error',
          title: 'Invalid Phone Number',
          description: phoneValidation.message,
        })
        setLoading(false)
        return
      }

      // Check for duplicates
      const duplicates = await checkForDuplicates(formData)
      if (duplicates.length > 0 && !returningPatient) {
        setDuplicateWarning({ show: true, matches: duplicates })
        setLoading(false)
        return
      }

      // If returning patient, update instead of creating new
      if (returningPatient) {
        const updated = await updatePatient(returningPatient.id, {
          ...formData,
          // Keep existing patient number
        })
        
        // Log activity
        if (user?.id) {
          try {
            await activityLogAPI.log({
              action: 'update_patient',
              module: 'patients',
              entity_type: 'patient',
              entity_id: returningPatient.id,
              details: {
                patient_number: returningPatient.patient_number,
                patient_name: `${updated.first_name} ${updated.last_name}`,
                updated_fields: Object.keys(formData),
                visit_reason: formData.visit_reason || null
              }
            })
          } catch (error) {
            console.warn('Failed to log activity:', error)
          }
        }
        
        toast({
          title: 'Patient Updated Successfully',
          description: `Patient ${updated.first_name} ${updated.last_name} information has been updated.`,
        })
        setReturningPatient(null)
        setActiveTab('search')
        setLoading(false)
        return
      }

      // 🎯 ACTUALLY SAVE TO CONTEXT - NOW WORKS!
      const patientData = {
        ...formData,
        patient_number: generatePatientNumber(),
        status: 'active' as const,
      }

      const newPatient = await addPatient(patientData)

      // Log patient registration activity
      if (user?.id) {
        try {
          await activityLogAPI.log({
            action: 'register_patient',
            module: 'patients',
            entity_type: 'patient',
            entity_id: newPatient.id,
            details: {
              patient_number: newPatient.patient_number,
              patient_name: `${newPatient.first_name} ${newPatient.last_name}`,
              phone: newPatient.phone,
              visit_reason: formData.visit_reason || null,
              visit_reason_category: visitReasonCategory || null,
              quick_registration: quickRegistrationMode
            }
          })
        } catch (error) {
          console.warn('Failed to log activity:', error)
        }
      }

      // If visit reason is provided, create a consultation record
      if (formData.visit_reason && newPatient.id) {
        try {
          const category = visitReasonCategory || categorizeVisitReason(formData.visit_reason)
          // Create consultation with visit reason and category
          const consultation = await consultationAPI.create({
            patient_id: newPatient.id,
            chief_complaint: formData.visit_reason,
            visit_reason_category: category,
            date: new Date().toISOString().split('T')[0],
            visit_time: new Date().toTimeString().split(' ')[0],
            status: 'completed',
            notes: `Visit reason: ${formData.visit_reason}${category ? ` (Category: ${VISIT_REASON_CATEGORIES.find(c => c.value === category)?.label})` : ''}`
          })
          
          // Log consultation creation
          if (user?.id && consultation?.id) {
            try {
              await activityLogAPI.log({
                action: 'create_consultation',
                module: 'consultations',
                entity_type: 'consultation',
                entity_id: consultation.id,
                details: {
                  patient_id: newPatient.id,
                  patient_number: newPatient.patient_number,
                  chief_complaint: formData.visit_reason,
                  visit_reason_category: category
                }
              })
            } catch (error) {
              console.warn('Failed to log consultation activity:', error)
            }
          }
        } catch (error) {
          // Log but don't fail registration if consultation creation fails
          console.warn('Failed to create consultation record:', error)
        }
      }

      toast({
        title: 'Patient Registered Successfully',
        description: `Patient Number: ${newPatient.patient_number}. Patient is now searchable and saved.${formData.visit_reason ? ' Visit reason recorded.' : ''}`,
      })

      // Reset form
      setFormData({
        first_name: '',
        last_name: '',
        date_of_birth: '',
        gender: '',
        phone: '',
        address: '',
        emergency_contact: '',
        emergency_phone: '',
        visit_reason: '',
      })
      setReturningPatient(null)
      setPhoneValidationError('')
      setVisitReasonCategory('')

      setActiveTab('search')
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Registration Failed',
        description: 'Unable to register patient. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearchPatient = async () => {
    if (!searchTerm.trim()) {
      toast({
        variant: 'error',
        title: 'Search Error',
        description: 'Please enter a search term',
      })
      return
    }

    setLoading(true)
    try {
      // 🎯 USE CONTEXT SEARCH - NOW SEARCHES ALL PATIENTS INCLUDING IMPORTED!
      const results = await searchPatients(searchTerm)
      
      // TODO: Also search via backend API when available
      // const response = await fetch(`/api/patients/search?q=${searchTerm}`)
      // const data = await response.json()

      setSearchResults(results)
      
      if (results.length === 0) {
        toast({
          title: 'No Results',
          description: 'No patients found matching your search',
        })
      } else {
        toast({
          title: 'Search Complete',
          description: `Found ${results.length} patient(s)`,
        })
      }
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Search Failed',
        description: 'Unable to search patients. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  // Get last visit date for a patient
  const getLastVisitDate = (patientId: string): Date | null => {
    if (patientConsultations.length > 0 && selectedPatient?.id === patientId) {
      const sorted = [...patientConsultations].sort((a, b) => {
        const dateA = new Date(a.visit_date || a.date || a.created_at || 0)
        const dateB = new Date(b.visit_date || b.date || b.created_at || 0)
        return dateB.getTime() - dateA.getTime()
      })
      return sorted[0] ? new Date(sorted[0].visit_date || sorted[0].date || sorted[0].created_at) : null
    }
    return null
  }

  const handleViewPatient = async (patient: Patient) => {
    setSelectedPatient(patient)
    setIsViewDialogOpen(true)
    
    // Load patient history
    setLoadingHistory(true)
    try {
      const [consultations, invoices, prescriptions] = await Promise.all([
        consultationAPI.getByPatientId(patient.id).catch(() => ({ data: [] })),
        invoiceAPI.getAll({ patient_id: patient.id }).catch(() => ({ data: [] })),
        prescriptionAPI.getAll({ patient_id: patient.id }).catch(() => ({ data: [] })),
      ])
      
      setPatientConsultations(consultations?.data || [])
      setPatientInvoices(invoices?.data || [])
      setPatientPrescriptions(prescriptions?.data || [])
    } catch (error) {
      console.error('Error loading patient history:', error)
      setPatientConsultations([])
      setPatientInvoices([])
      setPatientPrescriptions([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatient(patient)
    setFormData({
      first_name: patient.first_name,
      last_name: patient.last_name,
      date_of_birth: patient.date_of_birth,
      gender: patient.gender,
      phone: patient.phone,
        address: patient.address || '',
      emergency_contact: patient.emergency_contact || '',
      emergency_phone: patient.emergency_phone || '',
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!selectedPatient) {
        throw new Error('No patient selected')
      }

      // 🎯 ACTUALLY UPDATE IN CONTEXT - NOW WORKS!
      await updatePatient(selectedPatient.id, formData)
      
      // TODO: Also send to backend API when available
      // await fetch(`/api/patients/${selectedPatient.id}`, { 
      //   method: 'PUT', 
      //   body: JSON.stringify(formData) 
      // })

      toast({
        title: 'Patient Updated Successfully',
        description: `${formData.first_name} ${formData.last_name}'s information has been updated and saved.`,
      })

      setIsEditDialogOpen(false)
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Update Failed',
        description: 'Unable to update patient. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (value: string) => {
    setSearchFilter(value)
    if (!value.trim()) {
      setFilteredPatients(Array.isArray(patients) ? patients : [])
      return
    }

    const patientsArray = Array.isArray(patients) ? patients : []
    const filtered = patientsArray.filter(patient =>
      patient.first_name.toLowerCase().includes(value.toLowerCase()) ||
      patient.last_name.toLowerCase().includes(value.toLowerCase()) ||
      patient.patient_number.toLowerCase().includes(value.toLowerCase()) ||
      patient.phone.includes(value) ||
      (patient.insurance_type && patient.insurance_type.toLowerCase().includes(value.toLowerCase()))
    )
    setFilteredPatients(filtered)
  }

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Patient Management</h2>
          <p className="text-muted-foreground">
            Manage patient records, register new patients, and search existing records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsWizardOpen(true)} variant="default">
            <FileText className="w-4 h-4 mr-2" />
            Migration Wizard
          </Button>
          <PatientImport />
          <ImportProgressDashboard />
          <Badge variant="outline" className="text-lg px-4 py-2">
            <Users className="h-4 w-4 mr-2" />
            {getTotalPatients()} Patients ({getActivePatients()} Active)
          </Badge>
        </div>
        
        <MigrationWizard open={isWizardOpen} onOpenChange={setIsWizardOpen} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="records" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Patient Records
          </TabsTrigger>
          <TabsTrigger value="register" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            {quickRegistrationMode ? 'Quick Register' : 'Register New Patient'}
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Advanced Search
          </TabsTrigger>
        </TabsList>

        {/* Patient Records Tab */}
        <TabsContent value="records" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Patients</CardTitle>
              <CardDescription>
                View and manage all registered patients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filter Controls */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="Search by name, patient number, phone, or insurance..."
                      className="pl-10"
                      value={searchFilter}
                      onChange={(e) => handleFilterChange(e.target.value)}
                    />
                  </div>
                  <Badge variant="secondary" className="px-4 py-2">
                    {filteredPatients.length} results
                  </Badge>
                </div>
                
                {/* Date Range Filter */}
                <div className="flex items-center gap-4">
                  <DateRangeFilter
                    onDateRangeChange={setDateRange}
                    placeholder="Filter by registration date"
                    className="w-full sm:w-auto"
                  />
                  <div className="text-sm text-muted-foreground">
                    {dateRange.from || dateRange.to ? 
                      `Showing patients registered ${dateRange.from ? `from ${dateRange.from.toLocaleDateString()}` : ''} ${dateRange.to ? `to ${dateRange.to.toLocaleDateString()}` : ''}` : 
                      'Showing all patients'
                    }
                  </div>
                </div>
              </div>

              {/* Patients Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient No.</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Age/Gender</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Last Visit</TableHead>
                      <TableHead>Insurance</TableHead>
                      <TableHead>Blood Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No patients found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPatients.map((patient) => {
                        // Get last visit date (load if not already loaded)
                        const lastVisit = patientConsultations.length > 0 && selectedPatient?.id === patient.id
                          ? getLastVisitDate(patient.id)
                          : null
                        const isReturning = lastVisit !== null
                        const daysSinceVisit = lastVisit 
                          ? Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
                          : null

                        return (
                          <TableRow key={patient.id}>
                            <TableCell className="font-mono text-sm">
                              {patient.patient_number}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {patient.first_name} {patient.last_name}
                                {isReturning && (
                                  <Badge variant="outline" className="text-xs">
                                    Returning
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{calculateAge(patient.date_of_birth)} years</div>
                                <div className="text-muted-foreground capitalize">{patient.gender}</div>
                              </div>
                            </TableCell>
                            <TableCell>{patient.phone}</TableCell>
                            <TableCell>{patient.address}</TableCell>
                            <TableCell>
                              {isReturning && lastVisit ? (
                                <div className="text-sm">
                                  <div className="font-medium">
                                    {lastVisit.toLocaleDateString()}
                                  </div>
                                  {daysSinceVisit !== null && (
                                    <div className="text-muted-foreground text-xs">
                                      {daysSinceVisit === 0 
                                        ? 'Today' 
                                        : daysSinceVisit === 1 
                                        ? 'Yesterday'
                                        : `${daysSinceVisit} days ago`}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-sm">
                                  <Badge variant="secondary" className="text-xs">New Patient</Badge>
                                  <div className="text-muted-foreground text-xs mt-1">
                                    {new Date(patient.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {patient.insurance_type ? (
                                <Badge variant="outline">{patient.insurance_type}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {patient.blood_type ? (
                                <Badge variant="secondary">{patient.blood_type}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewPatient(patient)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditPatient(patient)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{quickRegistrationMode ? 'Quick Registration (Returning Patient)' : 'New Patient Registration'}</CardTitle>
                  <CardDescription>
                    {quickRegistrationMode 
                      ? 'Minimal data entry for returning patients - only phone and visit reason required'
                      : 'Enter patient details to create a new record'}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuickRegistrationMode(!quickRegistrationMode)
                    if (!quickRegistrationMode && returningPatient) {
                      // Pre-fill for quick mode
                      setFormData(prev => ({
                        ...prev,
                        first_name: returningPatient.first_name,
                        last_name: returningPatient.last_name,
                        date_of_birth: returningPatient.date_of_birth,
                        gender: returningPatient.gender,
                        phone: returningPatient.phone,
                        address: returningPatient.address || prev.address,
                      }))
                    }
                  }}
                >
                  {quickRegistrationMode ? 'Switch to Full Registration' : 'Switch to Quick Mode'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegisterPatient} className="space-y-6">
                {/* Personal Information - Hidden in quick mode if returning patient */}
                {(!quickRegistrationMode || !returningPatient) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input
                          id="first_name"
                          name="first_name"
                          value={formData.first_name}
                          onChange={handleInputChange}
                          required={!quickRegistrationMode}
                          disabled={quickRegistrationMode && !!returningPatient}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input
                          id="last_name"
                          name="last_name"
                          value={formData.last_name}
                          onChange={handleInputChange}
                          required={!quickRegistrationMode}
                          disabled={quickRegistrationMode && !!returningPatient}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date_of_birth">Date of Birth *</Label>
                        <Input
                          id="date_of_birth"
                          name="date_of_birth"
                          type="date"
                          value={formData.date_of_birth}
                          onChange={handleInputChange}
                          required={!quickRegistrationMode}
                          disabled={quickRegistrationMode && !!returningPatient}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gender">Gender *</Label>
                        <Select 
                          value={formData.gender} 
                          onValueChange={(value) => handleSelectChange('gender', value)}
                          disabled={quickRegistrationMode && !!returningPatient}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select gender" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                {quickRegistrationMode && returningPatient && (
                  <Alert className="border-blue-500 bg-blue-50">
                    <CheckCircle2 className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-900">
                      <strong>Quick Mode:</strong> Using existing patient data for {returningPatient.first_name} {returningPatient.last_name}. 
                      Only phone and visit reason are required.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 relative">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <Input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleInputChange}
                        placeholder="+254712345678 or 0712345678"
                        required
                        className={phoneValidationError ? 'border-red-500' : ''}
                      />
                      {phoneValidationError && (
                        <p className="text-sm text-red-500">{phoneValidationError}</p>
                      )}
                      {returningPatient && (
                        <Alert className="mt-2 border-blue-500 bg-blue-50">
                          <CheckCircle2 className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-900">
                            <strong>Returning Patient:</strong> {returningPatient.first_name} {returningPatient.last_name} 
                            ({returningPatient.patient_number}). Form pre-filled. Click "Register" to update or create new record.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                    {!quickRegistrationMode && (
                      <div className="space-y-2 relative">
                        <Label htmlFor="location">Residential Location *</Label>
                        <Input
                          id="location"
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          onFocus={() => {
                            if (formData.address.length > 0) {
                              const filtered = KENYAN_LOCATIONS.filter(loc => 
                                loc.toLowerCase().includes(formData.address.toLowerCase())
                              ).slice(0, 5)
                              setLocationSuggestions(filtered)
                              setShowLocationSuggestions(filtered.length > 0)
                            }
                          }}
                          onBlur={() => {
                            // Delay to allow click on suggestion
                            setTimeout(() => setShowLocationSuggestions(false), 200)
                          }}
                          placeholder="e.g., Nairobi, Kiambu, Mombasa"
                          required
                        />
                        {showLocationSuggestions && locationSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {locationSuggestions.map((location, index) => (
                              <button
                                key={index}
                                type="button"
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                                onClick={() => handleLocationSelect(location)}
                              >
                                {location}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Visit Reason */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Visit Information
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="visit_reason_category">Visit Category</Label>
                      <Select 
                        value={visitReasonCategory} 
                        onValueChange={(value) => {
                          setVisitReasonCategory(value as VisitReasonCategory)
                          // Auto-categorize if reason is already entered
                          if (formData.visit_reason && !value) {
                            const category = categorizeVisitReason(formData.visit_reason)
                            setVisitReasonCategory(category)
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select visit category (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {VISIT_REASON_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label} - {cat.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {visitReasonCategory && (
                        <p className="text-xs text-muted-foreground">
                          Category: {VISIT_REASON_CATEGORIES.find(c => c.value === visitReasonCategory)?.label}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="visit_reason">Reason for Visit / Chief Complaint</Label>
                      <Textarea
                        id="visit_reason"
                        name="visit_reason"
                        value={formData.visit_reason}
                        onChange={(e) => {
                          handleInputChange(e)
                          // Auto-categorize when user types
                          if (e.target.value.length > 10 && !visitReasonCategory) {
                            const category = categorizeVisitReason(e.target.value)
                            setVisitReasonCategory(category)
                          }
                        }}
                        placeholder="e.g., Follow-up for diabetes, New complaint: chest pain, Routine check-up, Emergency: severe headache..."
                        rows={3}
                      />
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {visitReasonCategory && (
                          <Badge variant="outline">
                            {VISIT_REASON_CATEGORIES.find(c => c.value === visitReasonCategory)?.label}
                          </Badge>
                        )}
                        <span>This helps track why the patient is visiting and will be linked to their consultation.</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Emergency Contact <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="emergency_contact">Contact Name</Label>
                      <Input
                        id="emergency_contact"
                        name="emergency_contact"
                        value={formData.emergency_contact}
                        onChange={handleInputChange}
                        placeholder="Optional - can be added later"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="emergency_phone">Contact Phone</Label>
                      <Input
                        id="emergency_phone"
                        name="emergency_phone"
                        type="tel"
                        value={formData.emergency_phone}
                        onChange={handleInputChange}
                        placeholder="+254712345678 (Optional)"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Emergency contact information can be added later if not available now.
                  </p>
                </div>


                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={() => setFormData({
                    first_name: '',
                    last_name: '',
                    date_of_birth: '',
                    gender: '',
                    phone: '',
                    address: '',
                    emergency_contact: '',
                    emergency_phone: '',
                    visit_reason: '',
                  })}>
                    Clear Form
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Registering...' : 'Register Patient'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Search Patients</CardTitle>
              <CardDescription>
                Search by patient number, name, phone, or insurance number
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter search term..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPatient()}
                />
                <Button onClick={handleSearchPatient} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((patient) => (
                    <Card key={patient.id} className="cursor-pointer hover:bg-accent" onClick={() => handleViewPatient(patient)}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{patient.first_name} {patient.last_name}</h4>
                              <Badge variant="outline">{patient.patient_number}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1 mt-2">
                              <p className="flex items-center gap-2">
                                <Phone className="h-3 w-3" />
                                {patient.phone}
                              </p>
                              <p className="flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                              </p>
                              {patient.insurance_type && (
                                <p className="flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Insurance: {patient.insurance_type}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedPatient && (
            <Card>
              <CardHeader>
                <CardTitle>Patient Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Patient Number</Label>
                    <p className="font-medium">{selectedPatient.patient_number}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">{new Date(selectedPatient.date_of_birth).toLocaleDateString()}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{selectedPatient.gender}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedPatient.phone}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">{selectedPatient.address}</p>
                  </div>
                  {selectedPatient.blood_type && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Blood Type</Label>
                      <p className="font-medium">{selectedPatient.blood_type}</p>
                    </div>
                  )}
                  {selectedPatient.insurance_type && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Insurance Provider</Label>
                        <p className="font-medium">{selectedPatient.insurance_type}</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Insurance Number</Label>
                        <p className="font-medium">{selectedPatient.insurance_number}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* View Patient Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Details</DialogTitle>
            <DialogDescription>Complete patient information and medical history</DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Patient Number</Label>
                    <p className="font-mono text-lg font-semibold">{selectedPatient.patient_number}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Full Name</Label>
                    <p className="font-medium">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Date of Birth</Label>
                    <p className="font-medium">
                      {new Date(selectedPatient.date_of_birth).toLocaleDateString()} 
                      <span className="text-muted-foreground ml-2">({calculateAge(selectedPatient.date_of_birth)} years)</span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Gender</Label>
                    <p className="font-medium capitalize">{selectedPatient.gender}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium">{selectedPatient.phone}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <p className="font-medium">{selectedPatient.address}</p>
                  </div>
                  {selectedPatient.blood_type && (
                    <div>
                      <Label className="text-muted-foreground">Blood Type</Label>
                      <Badge variant="secondary" className="text-base">{selectedPatient.blood_type}</Badge>
                    </div>
                  )}
                  {selectedPatient.allergies && (
                    <div>
                      <Label className="text-muted-foreground">Allergies</Label>
                      <Badge variant="destructive">{selectedPatient.allergies}</Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold">Emergency Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Contact Name</Label>
                    <p className="font-medium">{selectedPatient.emergency_contact}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Contact Phone</Label>
                    <p className="font-medium">{selectedPatient.emergency_phone}</p>
                  </div>
                </div>
              </div>

              {selectedPatient.insurance_type && (
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-semibold">Insurance Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Provider</Label>
                      <p className="font-medium">{selectedPatient.insurance_type}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Member Number</Label>
                      <p className="font-mono">{selectedPatient.insurance_number}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-muted-foreground">Registered</Label>
                <p className="text-sm">{new Date(selectedPatient.created_at).toLocaleString()}</p>
              </div>

              {/* Visit History */}
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Visit History & Medical Records
                </h4>
                
                {loadingHistory ? (
                  <div className="text-center py-4 text-muted-foreground">Loading history...</div>
                ) : (
                  <Tabs defaultValue="consultations" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="consultations">
                        <Stethoscope className="h-4 w-4 mr-2" />
                        Consultations ({patientConsultations.length})
                      </TabsTrigger>
                      <TabsTrigger value="prescriptions">
                        <Pill className="h-4 w-4 mr-2" />
                        Prescriptions ({patientPrescriptions.length})
                      </TabsTrigger>
                      <TabsTrigger value="invoices">
                        <Receipt className="h-4 w-4 mr-2" />
                        Invoices ({patientInvoices.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="consultations" className="space-y-2 mt-4">
                      {patientConsultations.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Stethoscope className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No consultations found</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {patientConsultations.map((consultation: any) => (
                            <Card key={consultation.id} className="border-l-4 border-l-blue-500">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline">{consultation.consultation_number || consultation.id}</Badge>
                                      <span className="text-sm text-muted-foreground">
                                        {new Date(consultation.visit_date || consultation.date || consultation.created_at).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="font-medium text-sm mb-1">
                                      {consultation.chief_complaint || consultation.chiefComplaint || 'No chief complaint recorded'}
                                    </p>
                                    {consultation.diagnosis && (
                                      <p className="text-sm text-muted-foreground">
                                        Diagnosis: {consultation.diagnosis}
                                      </p>
                                    )}
                                    {consultation.clinicianName && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Clinician: {consultation.clinicianName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="prescriptions" className="space-y-2 mt-4">
                      {patientPrescriptions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Pill className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No prescriptions found</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {patientPrescriptions.map((prescription: any) => (
                            <Card key={prescription.id} className="border-l-4 border-l-purple-500">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant={prescription.status === 'completed' ? 'default' : 'secondary'}>
                                        {prescription.status || 'pending'}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">
                                        {new Date(prescription.created_at || prescription.date).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="font-medium text-sm">
                                      {prescription.medication_name || prescription.medicationName || 'Unknown medication'}
                                    </p>
                                    {prescription.dosage && (
                                      <p className="text-sm text-muted-foreground">
                                        {prescription.dosage} - {prescription.frequency}
                                      </p>
                                    )}
                                    {prescription.instructions && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        {prescription.instructions}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="invoices" className="space-y-2 mt-4">
                      {patientInvoices.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No invoices found</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {patientInvoices.map((invoice: any) => (
                            <Card key={invoice.id} className="border-l-4 border-l-green-500">
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline">{invoice.invoice_number || invoice.id}</Badge>
                                      <Badge variant={invoice.payment_status === 'paid' ? 'default' : 'secondary'}>
                                        {invoice.payment_status || 'pending'}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">
                                        {new Date(invoice.created_at || invoice.date).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="font-medium text-sm">
                                      KSh {parseFloat(invoice.total_amount || invoice.total || 0).toLocaleString()}
                                    </p>
                                    {invoice.consultation_id && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Consultation: {invoice.consultation_id}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Patient Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Patient Information</DialogTitle>
            <DialogDescription>Update patient details for {selectedPatient?.first_name} {selectedPatient?.last_name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePatient} className="space-y-6">
            {/* Same form fields as registration, but pre-filled */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-first-name">First Name *</Label>
                  <Input
                    id="edit-first-name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-last-name">Last Name *</Label>
                  <Input
                    id="edit-last-name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-dob">Date of Birth *</Label>
                  <Input
                    id="edit-dob"
                    name="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-gender">Gender *</Label>
                  <Select value={formData.gender} onValueChange={(value) => handleSelectChange('gender', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone *</Label>
                  <Input
                    id="edit-phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-location">Location *</Label>
                  <Input
                    id="edit-location"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Emergency Contact</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-emergency-contact">Contact Name *</Label>
                  <Input
                    id="edit-emergency-contact"
                    name="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-emergency-phone">Contact Phone *</Label>
                  <Input
                    id="edit-emergency-phone"
                    name="emergency_phone"
                    value={formData.emergency_phone}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>


            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : 'Update Patient'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Duplicate Warning Dialog */}
      <Dialog open={duplicateWarning.show} onOpenChange={(open) => setDuplicateWarning({ show: open, matches: [] })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Possible Duplicate Patient Found
            </DialogTitle>
            <DialogDescription>
              We found {duplicateWarning.matches.length} existing patient(s) that may match the information you're entering.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="border-orange-500 bg-orange-50">
              <AlertDescription className="text-orange-900">
                Please review the matches below. If this is the same patient, click "Use Existing" to update their information. 
                Otherwise, click "Create New" to register as a new patient.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {duplicateWarning.matches.map((match) => (
                <Card key={match.id} className="border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{match.first_name} {match.last_name}</h4>
                          <Badge variant="outline">{match.patient_number}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1 mt-2">
                          <p>Phone: {match.phone}</p>
                          <p>DOB: {new Date(match.date_of_birth).toLocaleDateString()}</p>
                          {match.address && <p>Location: {match.address}</p>}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReturningPatient(match)
                          setFormData(prev => ({
                            ...prev,
                            first_name: match.first_name,
                            last_name: match.last_name,
                            date_of_birth: match.date_of_birth,
                            gender: match.gender,
                            phone: match.phone,
                            address: match.address || prev.address,
                            emergency_contact: match.emergency_contact || prev.emergency_contact,
                            emergency_phone: match.emergency_phone || prev.emergency_phone,
                          }))
                          setDuplicateWarning({ show: false, matches: [] })
                          toast({
                            title: 'Patient Selected',
                            description: 'Form pre-filled with existing patient data. Click "Register" to update.',
                          })
                        }}
                      >
                        Use Existing
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setDuplicateWarning({ show: false, matches: [] })}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  // Proceed with new registration
                  setDuplicateWarning({ show: false, matches: [] })
                  const patientData = {
                    ...formData,
                    patient_number: generatePatientNumber(),
                    status: 'active' as const,
                  }
                  const newPatient = await addPatient(patientData)
                  toast({
                    title: 'New Patient Registered',
                    description: `Patient ${newPatient.first_name} ${newPatient.last_name} registered as new patient.`,
                  })
                  setFormData({
                    first_name: '',
                    last_name: '',
                    date_of_birth: '',
                    gender: '',
                    phone: '',
                    address: '',
                    emergency_contact: '',
                    emergency_phone: '',
                  })
                  setActiveTab('search')
                }}
              >
                Create New Patient
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

