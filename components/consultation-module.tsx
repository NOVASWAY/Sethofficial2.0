'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Stethoscope, Activity, FileText, Pill, Calendar, User,
  Heart, Thermometer, Scale, Ruler, Plus, X, Save, ArrowRight,
  FlaskConical
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePatient, type Consultation as PatientConsultation } from '@/contexts/patient-context'
import { PatientHistoryPanel } from './patient-history-panel'
import { useWorkflow } from '@/contexts/workflow-context'
import { useRouter } from 'next/navigation'
import { consultationAPI, serviceCatalogAPI, prescriptionAPI, patientAPI, pharmacyAPI, activityLogAPI, labAPI, CreateLabTestOrder } from '@/lib/api-client'
import { useAuth } from '@/contexts/auth-context'
import { icd11Diagnoses, type Diagnosis as ICD11Diagnosis } from '@/lib/icd11-diagnoses'
import { NotesPanel } from './notes-panel'

interface VitalSigns {
  temperature?: number
  blood_pressure?: string
  pulse?: number
  weight?: number
  height?: number
  respiratory_rate?: number
  oxygen_saturation?: number
}

interface Prescription {
  medication_id: string
  medication_name: string
  dosage: string
  frequency: string
  duration_days: number
  quantity: number
  instructions: string
}

interface Service {
  id: string
  service_code: string
  service_name: string
  category: string
  unit_price: number
  sha_approved: boolean
}

interface PatientInfo {
  id: string
  name: string
  patientNumber: string
  age: number | null
  gender: string
  insuranceType?: string
}

export function ConsultationModule() {
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useAuth()

  // Get search params from URL (using window.location as fallback for Next.js compatibility)
  const getSearchParams = (): URLSearchParams | null => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search)
    }
    return null
  }
  const { checkMedicationAllergy, addConsultation } = usePatient()
  const { setPendingConsultation } = useWorkflow()
  const [activeTab, setActiveTab] = useState('vitals')
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [labOrders, setLabOrders] = useState<Array<{
    id: string
    test_type: string
    test_name: string
    test_code?: string
    priority: 'routine' | 'urgent' | 'stat'
    clinical_indication?: string
    sample_type?: string
  }>>([])
  const [newLabOrder, setNewLabOrder] = useState<{
    test_type: string
    test_name: string
    test_code?: string
    priority: 'routine' | 'urgent' | 'stat'
    clinical_indication: string
    sample_type: string
  }>({
    test_type: '',
    test_name: '',
    test_code: '',
    priority: 'routine',
    clinical_indication: '',
    sample_type: '',
  })
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)
  const [loadingPatient, setLoadingPatient] = useState(false)
  const [medicines, setMedicines] = useState<Array<{
    id: string
    name: string
    generic_name?: string
    dosage_form: string
    strength: string
    current_stock?: number
    unit_price: number
  }>>([])
  const [medicineSearchTerm, setMedicineSearchTerm] = useState('')
  const [icd11SearchTerm, setIcd11SearchTerm] = useState('')
  const [showIcd11Suggestions, setShowIcd11Suggestions] = useState(false)
  const [currentConsultationId, setCurrentConsultationId] = useState<string | null>(null)

  const [consultationData, setConsultationData] = useState({
    patient_id: '',
    patient_name: '',
    clinician_id: '',
    appointment_id: '',
    chief_complaint: '',
    physical_examination: '',
    diagnosis: '',
    icd_11_codes: '',
    treatment_plan: '',
    notes: '',
    follow_up_date: '',
  })

  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    temperature: undefined,
    blood_pressure: '',
    pulse: undefined,
    weight: undefined,
    height: undefined,
    respiratory_rate: undefined,
    oxygen_saturation: undefined,
  })

  const [newPrescription, setNewPrescription] = useState<Prescription>({
    medication_id: '',
    medication_name: '',
    dosage: '',
    frequency: '',
    duration_days: 7,
    quantity: 1,
    instructions: '',
  })

  useEffect(() => {
    loadServices()
    loadPatientData()
    loadMedicines()
    // Set current user as clinician if available
    if (user && (user.role === 'clinician' || user.role === 'admin')) {
      setConsultationData(prev => ({ ...prev, clinician_id: user.id }))
    }
  }, [user])

  const loadPatientData = async () => {
    // Try to get patient ID from URL params first
    const searchParams = getSearchParams()
    const patientIdFromUrl = searchParams?.get('patient_id') || searchParams?.get('patientId')

    // If not in URL, try to get from consultationData (if already set)
    const patientId = patientIdFromUrl || consultationData.patient_id

    if (!patientId) {
      // No patient ID available - user will need to select patient
      return
    }

    try {
      setLoadingPatient(true)
      const patientData = await patientAPI.getById(patientId)

      if (patientData && patientData.id) {
        // Calculate age from date of birth
        let age: number | null = null
        if (patientData.date_of_birth || patientData.dateOfBirth) {
          const dob = new Date(patientData.date_of_birth || patientData.dateOfBirth)
          const today = new Date()
          age = today.getFullYear() - dob.getFullYear()
          const monthDiff = today.getMonth() - dob.getMonth()
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--
          }
        }

        const patient: PatientInfo = {
          id: patientData.id,
          name: `${patientData.first_name || patientData.firstName || ''} ${patientData.last_name || patientData.lastName || ''}`.trim(),
          patientNumber: patientData.patient_number || patientData.patientNumber || '',
          age,
          gender: patientData.gender || 'Unknown',
          insuranceType: patientData.insurance_type || patientData.insuranceType
        }

        setPatientInfo(patient)
        setConsultationData(prev => ({
          ...prev,
          patient_id: patient.id,
          patient_name: patient.name
        }))
      }
    } catch (error) {
      console.error("Error loading patient data:", error)
      // Silently fail - patient data will remain empty or user can select manually
    } finally {
      setLoadingPatient(false)
    }
  }

  const loadMedicines = async () => {
    try {
      const medicinesData = await pharmacyAPI.getMedicines({ page: 1, per_page: 200 })

      if (medicinesData && medicinesData.data && Array.isArray(medicinesData.data)) {
        const transformed = medicinesData.data.map((med: any) => ({
          id: med.id,
          name: med.name || '',
          generic_name: med.generic_name || med.genericName,
          dosage_form: med.dosage_form || med.dosageForm || '',
          strength: med.strength || '',
          current_stock: med.current_stock || med.currentStock || 0,
          unit_price: med.unit_price || med.unitPrice || 0
        }))
        setMedicines(transformed)
      }
    } catch (error) {
      console.error("Error loading medicines:", error)
      // Silently fail - user can still type manually
    }
  }

  const loadServices = async () => {
    try {
      setLoading(true)
      const servicesData = await serviceCatalogAPI.getAll()

      if (servicesData && Array.isArray(servicesData)) {
        // Transform API response to match Service interface
        const transformed = servicesData.map((service: any) => ({
          id: service.id || service.service_id || crypto.randomUUID(),
          service_code: service.service_code || service.code || '',
          service_name: service.service_name || service.name || '',
          category: service.category || 'other',
          unit_price: service.unit_price || service.price || 0,
          sha_approved: service.sha_approved || service.sha_approved === true || false,
        }))
        setServices(transformed)
      } else {
        // Fallback to mock services if API fails or returns no data
        const mockServices: Service[] = [
          {
            id: '1',
            service_code: 'CONSULT-001',
            service_name: 'General Consultation',
            category: 'consultation',
            unit_price: 500,
            sha_approved: true,
          },
          {
            id: '2',
            service_code: 'LAB-001',
            service_name: 'Complete Blood Count',
            category: 'laboratory',
            unit_price: 800,
            sha_approved: true,
          },
          {
            id: '3',
            service_code: 'PROC-001',
            service_name: 'Wound Dressing',
            category: 'procedure',
            unit_price: 500,
            sha_approved: true,
          },
        ]
        setServices(mockServices)
        toast({
          title: "Info",
          description: "Using default services. Service catalog API not available.",
          variant: "default"
        })
      }
    } catch (error) {
      console.error("Error loading services:", error)
      // Fallback to mock services on error
      const mockServices: Service[] = [
        {
          id: '1',
          service_code: 'CONSULT-001',
          service_name: 'General Consultation',
          category: 'consultation',
          unit_price: 500,
          sha_approved: true,
        },
        {
          id: '2',
          service_code: 'LAB-001',
          service_name: 'Complete Blood Count',
          category: 'laboratory',
          unit_price: 800,
          sha_approved: true,
        },
        {
          id: '3',
          service_code: 'PROC-001',
          service_name: 'Wound Dressing',
          category: 'procedure',
          unit_price: 500,
          sha_approved: true,
        },
      ]
      setServices(mockServices)
      toast({
        title: "Warning",
        description: "Failed to load services from API. Using default services.",
        variant: "default"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVitalSignsChange = (name: keyof VitalSigns, value: any) => {
    setVitalSigns(prev => ({ ...prev, [name]: value }))
  }

  const handleConsultationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setConsultationData(prev => ({ ...prev, [name]: value }))
  }

  const handleMedicineSelect = (medicineId: string) => {
    const selectedMedicine = medicines.find(m => m.id === medicineId)
    if (selectedMedicine) {
      setNewPrescription({
        ...newPrescription,
        medication_id: selectedMedicine.id,
        medication_name: selectedMedicine.name,
        dosage: selectedMedicine.strength || '',
      })
      setMedicineSearchTerm('')
    }
  }

  const filteredMedicines = medicines.filter(med =>
    med.name.toLowerCase().includes(medicineSearchTerm.toLowerCase()) ||
    (med.generic_name && med.generic_name.toLowerCase().includes(medicineSearchTerm.toLowerCase()))
  ).slice(0, 10) // Limit to 10 results for performance

  // Filter ICD-11 diagnoses based on search term or diagnosis text
  const filteredICD11Codes = icd11Diagnoses.filter(diagnosis => {
    if (!icd11SearchTerm && !consultationData.diagnosis) return false
    const searchTerm = icd11SearchTerm.toLowerCase() || consultationData.diagnosis.toLowerCase()
    return (
      diagnosis.code.toLowerCase().includes(searchTerm) ||
      diagnosis.name.toLowerCase().includes(searchTerm) ||
      diagnosis.keywords.some(kw => kw.toLowerCase().includes(searchTerm))
    )
  }).slice(0, 10) // Limit to 10 results

  const handleICD11Select = (diagnosis: ICD11Diagnosis) => {
    // Update diagnosis field with full diagnosis name
    setConsultationData(prev => ({
      ...prev,
      diagnosis: diagnosis.name,
      icd_11_codes: prev.icd_11_codes
        ? `${prev.icd_11_codes}, ${diagnosis.code}`
        : diagnosis.code
    }))
    setIcd11SearchTerm('')
    setShowIcd11Suggestions(false)
  }

  const addPrescription = () => {
    if (!newPrescription.medication_name || !newPrescription.dosage || !newPrescription.frequency) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: 'Please fill in all required prescription fields (medication, dosage, frequency)',
      })
      return
    }

    // Check for medication allergies
    const allergy = checkMedicationAllergy(consultationData.patient_id, newPrescription.medication_name)
    if (allergy) {
      toast({
        variant: 'error',
        title: '⚠️ ALLERGY ALERT',
        description: `Patient is allergic to ${allergy.allergen} (${allergy.severity}). Cannot prescribe ${newPrescription.medication_name}.`,
        duration: 10000, // Show for 10 seconds
      })
      return
    }

    // Check stock availability if medicine is from catalog
    const selectedMedicine = newPrescription.medication_id
      ? medicines.find(m => m.id === newPrescription.medication_id)
      : null

    if (selectedMedicine && selectedMedicine.current_stock !== undefined) {
      if (selectedMedicine.current_stock <= 0) {
        toast({
          variant: 'error',
          title: '⚠️ OUT OF STOCK',
          description: `${selectedMedicine.name} is currently out of stock. Please check with pharmacy or select alternative medication.`,
          duration: 8000,
        })
        return
      } else if (selectedMedicine.current_stock < newPrescription.quantity) {
        toast({
          variant: 'default',
          title: '⚠️ LOW STOCK WARNING',
          description: `Only ${selectedMedicine.current_stock} units available. Requested quantity: ${newPrescription.quantity}`,
          duration: 6000,
        })
      }
    }

    setPrescriptions([...prescriptions, { ...newPrescription }])
    setNewPrescription({
      medication_id: '',
      medication_name: '',
      dosage: '',
      frequency: '',
      duration_days: 7,
      quantity: 1,
      instructions: '',
    })
    setMedicineSearchTerm('')

    toast({
      title: 'Prescription Added',
      description: `${newPrescription.medication_name} added to prescription list`,
    })
  }

  const removePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index))
  }

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    )
  }

  const addLabOrder = () => {
    if (!newLabOrder.test_name || !newLabOrder.test_type) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Test name and type are required',
      })
      return
    }

    if (!consultationData.patient_id) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select a patient first',
      })
      return
    }

    setLabOrders([...labOrders, {
      id: crypto.randomUUID(),
      ...newLabOrder,
    }])

    setNewLabOrder({
      test_type: '',
      test_name: '',
      test_code: '',
      priority: 'routine',
      clinical_indication: '',
      sample_type: '',
    })

    toast({
      title: 'Lab Test Added',
      description: `${newLabOrder.test_name} added to lab test orders`,
    })
  }

  const removeLabOrder = (index: number) => {
    setLabOrders(labOrders.filter((_, i) => i !== index))
  }

  const generateConsultationNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `CON-${year}${month}-${random}`
  }

  const handleSaveAndBill = async () => {
    setLoading(true)
    try {
      // Validate required fields
      if (!consultationData.chief_complaint || !consultationData.diagnosis) {
        toast({
          variant: 'error',
          title: 'Validation Error',
          description: 'Chief complaint and diagnosis are required',
        })
        setLoading(false)
        return
      }

      // ZERO TRUST GUARD: Ensure only clinicians/doctors/admins can finalize consultations
      const allowedRoles = ['clinician', 'admin']
      if (user && !allowedRoles.includes(user.role)) {
        toast({
          variant: 'destructive',
          title: 'Action Denied',
          description: `Your role (${user.role}) is not authorized to finalize consultations and bill patients. Please refer to a clinician.`,
          duration: 8000
        })
        setLoading(false)
        return
      }

      const consultationNumber = generateConsultationNumber()

      // Prepare consultation data for workflow
      const workflowData = {
        consultation_id: crypto.randomUUID(),
        consultation_number: consultationNumber,
        patient_id: consultationData.patient_id,
        patient_name: consultationData.patient_name,
        clinician_name: consultationData.clinician_id || 'Unknown',
        date: new Date().toISOString().split('T')[0],
        chief_complaint: consultationData.chief_complaint,
        diagnosis: consultationData.diagnosis,
        icd_code: consultationData.icd_11_codes,
        prescriptions: prescriptions.map(p => ({
          ...p,
          medication_id: p.medication_id || crypto.randomUUID(),
        })),
        services: services.filter(s => selectedServices.includes(s.id)).map(s => ({
          id: s.id,
          service_code: s.service_code,
          service_name: s.service_name,
          unit_price: s.unit_price,
          category: s.category,
        })),
        notes: consultationData.notes || '',
        insurance_type: 'cash' as 'cash' | 'sha' | 'mixed',
      }

      // Save to patient context for history
      const patientConsultation: PatientConsultation = {
        id: workflowData.consultation_id,
        consultationNumber: consultationNumber,
        patientId: consultationData.patient_id,
        clinicianName: workflowData.clinician_name,
        date: workflowData.date,
        chiefComplaint: consultationData.chief_complaint,
        diagnosis: consultationData.diagnosis,
        icdCode: consultationData.icd_11_codes,
        prescriptions: prescriptions.map(p => ({
          id: crypto.randomUUID(),
          medicationName: p.medication_name,
          dosage: p.dosage,
          frequency: p.frequency,
          duration: `${p.duration_days} days`,
          quantity: p.quantity,
          instructions: p.instructions,
          status: 'pending' as const,
        })),
        services: workflowData.services.map(s => ({
          id: s.id,
          serviceName: s.service_name,
          amount: s.unit_price,
        })),
        notes: consultationData.notes || '',
      }

      // Prepare consultation data for API
      const consultationPayload = {
        patient_id: consultationData.patient_id,
        doctor_id: consultationData.clinician_id || null,
        appointment_id: consultationData.appointment_id || null,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].substring(0, 5), // HH:MM format
        chief_complaint: consultationData.chief_complaint,
        physical_examination: consultationData.physical_examination || '',
        diagnosis: consultationData.diagnosis,
        icd_11_codes: consultationData.icd_11_codes || '',
        treatment_plan: consultationData.treatment_plan || '',
        notes: consultationData.notes || '',
        follow_up_date: consultationData.follow_up_date || null,
        vital_signs: {
          temperature: vitalSigns.temperature,
          blood_pressure: vitalSigns.blood_pressure,
          pulse: vitalSigns.pulse,
          weight: vitalSigns.weight,
          height: vitalSigns.height,
          respiratory_rate: vitalSigns.respiratory_rate,
          oxygen_saturation: vitalSigns.oxygen_saturation,
        },
      }

      // Save consultation to API
      let consultationId: string | null = null
      try {
        const apiResponse = await consultationAPI.create(consultationPayload)

        // Update workflow data with API response ID if available
        if (apiResponse && apiResponse.id) {
          consultationId = apiResponse.id
          setCurrentConsultationId(apiResponse.id) // Store for notes panel
          workflowData.consultation_id = apiResponse.id
          patientConsultation.id = apiResponse.id
        }

        toast({
          title: 'Consultation Saved',
          description: `Consultation ${consultationNumber} has been saved to the database.`,
        })
      } catch (apiError) {
        console.error("Error saving consultation to API:", apiError)
        toast({
          variant: 'default',
          title: 'Consultation Saved Locally',
          description: 'Consultation saved to workflow context. API save failed.',
        })
      }

      // Create lab test orders when consultation is saved
      if (consultationId && labOrders.length > 0) {
        try {
          for (const labOrder of labOrders) {
            const labOrderData: CreateLabTestOrder = {
              patient_id: consultationData.patient_id,
              consultation_id: consultationId,
              ordering_clinician_id: consultationData.clinician_id || user?.id || '',
              test_type: labOrder.test_type,
              test_code: labOrder.test_code || undefined,
              test_name: labOrder.test_name,
              priority: labOrder.priority,
              clinical_indication: labOrder.clinical_indication || undefined,
              sample_type: labOrder.sample_type || undefined,
            }

            await labAPI.createOrder(labOrderData)

            // Log lab order creation activity
            if (user?.id) {
              try {
                await activityLogAPI.log({
                  action: 'create_lab_order',
                  module: 'laboratory',
                  entity_type: 'lab_order',
                  entity_id: labOrder.id,
                  description: `Lab test order created: ${labOrder.test_name}`,
                  user_id: user.id,
                })
              } catch (logError) {
                console.error('Error logging lab order activity:', logError)
              }
            }
          }

          toast({
            title: 'Lab Test Orders Created',
            description: `${labOrders.length} lab test order(s) created successfully`,
          })
        } catch (labError) {
          console.error('Error creating lab test orders:', labError)
          toast({
            variant: 'destructive',
            title: 'Lab Order Error',
            description: 'Failed to create some lab test orders',
          })
        }
      }

      // 🔥 CRITICAL FIX: Auto-create prescriptions when consultation is saved
      if (consultationId && prescriptions.length > 0) {
        try {
          // Prepare all medicines array for single prescription
          const medicinesArray = prescriptions.map(prescription => ({
            medicine_id: prescription.medication_id || undefined,
            medicine_name: prescription.medication_name,
            dosage: prescription.dosage,
            frequency: prescription.frequency,
            duration: prescription.duration_days.toString(),
            quantity: prescription.quantity,
            instructions: prescription.instructions || ''
          }))

          // Create a single prescription with all medicines (backend expects this format)
          const prescriptionData = {
            patient_id: consultationData.patient_id,
            doctor_id: consultationData.clinician_id || user?.id || '',
            consultation_id: consultationId, // Link to consultation
            medicines: medicinesArray,
            instructions: prescriptions.length === 1
              ? (prescriptions[0].instructions || `Take ${prescriptions[0].medication_name} ${prescriptions[0].dosage} ${prescriptions[0].frequency} for ${prescriptions[0].duration_days} days`)
              : `Multiple medications prescribed. See individual medication instructions.`,
            status: "active"
          }

          const prescriptionResult = await prescriptionAPI.create(prescriptionData)

          if (prescriptionResult) {
            // Log prescription creation activity
            if (user?.id && prescriptionResult.id) {
              try {
                await activityLogAPI.log({
                  action: 'create_prescription',
                  module: 'pharmacy',
                  entity_type: 'prescription',
                  entity_id: prescriptionResult.id,
                  details: {
                    consultation_id: consultationId,
                    patient_id: consultationData.patient_id,
                    medication_count: prescriptions.length,
                    medications: prescriptions.map(p => p.medication_name)
                  }
                })
              } catch (error) {
                console.warn('Failed to log prescription activity:', error)
              }
            }

            toast({
              title: 'Prescriptions Created Successfully',
              description: `${prescriptions.length} medication(s) have been saved as a prescription and linked to this consultation.`,
            })
          }
        } catch (prescriptionError) {
          console.error("Error creating prescriptions:", prescriptionError)
          toast({
            variant: 'error',
            title: 'Prescription Creation Failed',
            description: prescriptionError instanceof Error
              ? `Consultation was saved, but prescriptions failed to save: ${prescriptionError.message}. Please create them manually from the prescriptions page.`
              : 'Consultation was saved, but prescriptions failed to save. Please create them manually from the prescriptions page.',
          })
        }
      } else if (prescriptions.length > 0 && !consultationId) {
        // If consultation wasn't saved, warn user about prescriptions
        toast({
          variant: 'default',
          title: 'Prescriptions Not Saved',
          description: 'Prescriptions were not saved because consultation save failed. Please create prescriptions manually.',
        })
      }

      // Save to patient context for history
      addConsultation(consultationData.patient_id, patientConsultation)

      // Set to workflow context for billing
      setPendingConsultation(workflowData)

      toast({
        title: 'Consultation Completed',
        description: `Consultation ${consultationNumber} saved. ${prescriptions.length} prescription(s) sent to pharmacy. Redirecting to billing...`,
      })

      // Navigate to billing with consultation data
      setTimeout(() => {
        router.push('/dashboard/receptionist/billing')
      }, 1000)
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Save Failed',
        description: 'Unable to save consultation. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const calculateBMI = () => {
    if (vitalSigns.weight && vitalSigns.height) {
      const heightInMeters = vitalSigns.height / 100
      const bmi = vitalSigns.weight / (heightInMeters * heightInMeters)
      return bmi.toFixed(1)
    }
    return 'N/A'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Patient Consultation</h2>
          <p className="text-muted-foreground">
            Record patient visit and create treatment plan
          </p>
        </div>
        <Button size="lg" onClick={handleSaveAndBill} disabled={loading}>
          <Save className="mr-2 h-4 w-4" />
          Save & Proceed to Billing
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Consultation Area - 2 columns */}
        <div className="lg:col-span-2 space-y-6">

          {/* Patient Info Banner */}
          <Card className="bg-primary/5">
            <CardContent className="pt-6">
              {loadingPatient ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Loading patient information...</p>
                </div>
              ) : patientInfo ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Patient</Label>
                    <p className="font-semibold">{patientInfo.name || 'Not specified'}</p>
                    <p className="text-sm text-muted-foreground">{patientInfo.patientNumber || consultationData.patient_id || 'No patient number'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Age / Gender</Label>
                    <p className="font-semibold">
                      {patientInfo.age !== null ? `${patientInfo.age} years` : 'Age not available'} / {patientInfo.gender || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Insurance</Label>
                    <Badge variant="outline">
                      {patientInfo.insuranceType ? patientInfo.insuranceType.toUpperCase() : 'Not specified'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Visit Date</Label>
                    <p className="font-semibold">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Patient</Label>
                    <p className="font-semibold text-muted-foreground">No patient selected</p>
                    <p className="text-sm text-muted-foreground">
                      {consultationData.patient_id ? `ID: ${consultationData.patient_id}` : 'Please select a patient'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Age / Gender</Label>
                    <p className="font-semibold text-muted-foreground">Not available</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Insurance</Label>
                    <Badge variant="outline">Not specified</Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Visit Date</Label>
                    <p className="font-semibold">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="vitals">
                <Activity className="mr-2 h-4 w-4" />
                Vitals
              </TabsTrigger>
              <TabsTrigger value="examination">
                <Stethoscope className="mr-2 h-4 w-4" />
                Examination
              </TabsTrigger>
              <TabsTrigger value="diagnosis">
                <FileText className="mr-2 h-4 w-4" />
                Diagnosis
              </TabsTrigger>
              <TabsTrigger value="prescriptions">
                <Pill className="mr-2 h-4 w-4" />
                Prescriptions
              </TabsTrigger>
              <TabsTrigger value="lab-tests">
                <FlaskConical className="mr-2 h-4 w-4" />
                Lab Tests
              </TabsTrigger>
              <TabsTrigger value="services">
                <Heart className="mr-2 h-4 w-4" />
                Services
              </TabsTrigger>
              <TabsTrigger value="notes">
                <FileText className="mr-2 h-4 w-4" />
                Notes
              </TabsTrigger>
            </TabsList>

            {/* Vital Signs Tab */}
            <TabsContent value="vitals" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vital Signs</CardTitle>
                  <CardDescription>Record patient vital signs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="temperature">
                        <Thermometer className="inline h-4 w-4 mr-1" />
                        Temperature (°C)
                      </Label>
                      <Input
                        id="temperature"
                        type="number"
                        step="0.1"
                        placeholder="36.5"
                        value={vitalSigns.temperature || ''}
                        onChange={(e) => handleVitalSignsChange('temperature', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="blood_pressure">
                        <Heart className="inline h-4 w-4 mr-1" />
                        Blood Pressure (mmHg)
                      </Label>
                      <Input
                        id="blood_pressure"
                        placeholder="120/80"
                        value={vitalSigns.blood_pressure}
                        onChange={(e) => handleVitalSignsChange('blood_pressure', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pulse">
                        <Activity className="inline h-4 w-4 mr-1" />
                        Pulse (bpm)
                      </Label>
                      <Input
                        id="pulse"
                        type="number"
                        placeholder="72"
                        value={vitalSigns.pulse || ''}
                        onChange={(e) => handleVitalSignsChange('pulse', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weight">
                        <Scale className="inline h-4 w-4 mr-1" />
                        Weight (kg)
                      </Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.1"
                        placeholder="70"
                        value={vitalSigns.weight || ''}
                        onChange={(e) => handleVitalSignsChange('weight', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height">
                        <Ruler className="inline h-4 w-4 mr-1" />
                        Height (cm)
                      </Label>
                      <Input
                        id="height"
                        type="number"
                        placeholder="170"
                        value={vitalSigns.height || ''}
                        onChange={(e) => handleVitalSignsChange('height', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>BMI</Label>
                      <div className="flex items-center h-10 px-3 border rounded-md bg-muted">
                        <span className="font-semibold">{calculateBMI()}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="respiratory_rate">Respiratory Rate (bpm)</Label>
                      <Input
                        id="respiratory_rate"
                        type="number"
                        placeholder="16"
                        value={vitalSigns.respiratory_rate || ''}
                        onChange={(e) => handleVitalSignsChange('respiratory_rate', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="oxygen_saturation">SpO2 (%)</Label>
                      <Input
                        id="oxygen_saturation"
                        type="number"
                        step="0.1"
                        placeholder="98"
                        value={vitalSigns.oxygen_saturation || ''}
                        onChange={(e) => handleVitalSignsChange('oxygen_saturation', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Examination Tab */}
            <TabsContent value="examination" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Clinical Examination</CardTitle>
                  <CardDescription>Record examination findings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="chief_complaint">Chief Complaint *</Label>
                    <Textarea
                      id="chief_complaint"
                      name="chief_complaint"
                      placeholder="What brings the patient in today?"
                      value={consultationData.chief_complaint}
                      onChange={handleConsultationChange}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="physical_examination">Physical Examination</Label>
                    <Textarea
                      id="physical_examination"
                      name="physical_examination"
                      placeholder="General appearance, systems examination..."
                      value={consultationData.physical_examination}
                      onChange={handleConsultationChange}
                      rows={6}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Diagnosis Tab */}
            <TabsContent value="diagnosis" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Diagnosis & Treatment Plan</CardTitle>
                  <CardDescription>Record diagnosis and treatment recommendations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="diagnosis">Diagnosis *</Label>
                    <Textarea
                      id="diagnosis"
                      name="diagnosis"
                      placeholder="Clinical diagnosis..."
                      value={consultationData.diagnosis}
                      onChange={handleConsultationChange}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icd_11_codes">ICD-11 Codes</Label>
                    <div className="relative">
                      <Input
                        id="icd_11_codes"
                        name="icd_11_codes"
                        placeholder="Search ICD-11 codes (e.g., 1A00, Malaria, or type diagnosis)..."
                        value={icd11SearchTerm || consultationData.icd_11_codes}
                        onChange={(e) => {
                          const value = e.target.value
                          setIcd11SearchTerm(value)
                          // Also allow manual entry
                          if (!filteredICD11Codes.find(d => d.code === value || d.name === value)) {
                            setConsultationData(prev => ({ ...prev, icd_11_codes: value }))
                          }
                        }}
                        onFocus={() => {
                          if (consultationData.diagnosis || icd11SearchTerm) {
                            setShowIcd11Suggestions(true)
                          }
                        }}
                        onBlur={() => {
                          // Delay hiding suggestions to allow click
                          setTimeout(() => setShowIcd11Suggestions(false), 200)
                        }}
                      />
                      {(showIcd11Suggestions || icd11SearchTerm) && filteredICD11Codes.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b">
                            ICD-11 Suggestions
                          </div>
                          {filteredICD11Codes.map((diagnosis) => (
                            <div
                              key={diagnosis.code}
                              className="px-4 py-2 hover:bg-accent cursor-pointer border-b last:border-0"
                              onClick={() => handleICD11Select(diagnosis)}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-sm">{diagnosis.code}</p>
                                  <p className="text-sm">{diagnosis.name}</p>
                                  {diagnosis.common && (
                                    <Badge variant="outline" className="text-xs mt-1">Common</Badge>
                                  )}
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {diagnosis.category}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {consultationData.icd_11_codes && (
                      <p className="text-xs text-muted-foreground">
                        Selected codes: {consultationData.icd_11_codes}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="treatment_plan">Treatment Plan</Label>
                    <Textarea
                      id="treatment_plan"
                      name="treatment_plan"
                      placeholder="Treatment recommendations, lifestyle advice..."
                      value={consultationData.treatment_plan}
                      onChange={handleConsultationChange}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="follow_up_date">Follow-up Date</Label>
                    <Input
                      id="follow_up_date"
                      name="follow_up_date"
                      type="date"
                      value={consultationData.follow_up_date}
                      onChange={handleConsultationChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Additional Notes</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder="Any additional observations or instructions..."
                      value={consultationData.notes}
                      onChange={handleConsultationChange}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Prescriptions Tab */}
            <TabsContent value="prescriptions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Prescriptions</CardTitle>
                  <CardDescription>Add medications to prescribe</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Medication Name *</Label>
                      <div className="relative">
                        <Input
                          placeholder="Search or type medication name..."
                          value={medicineSearchTerm || newPrescription.medication_name}
                          onChange={(e) => {
                            const value = e.target.value
                            setMedicineSearchTerm(value)
                            // Allow manual entry if not selecting from dropdown
                            if (!medicines.find(m => m.name.toLowerCase() === value.toLowerCase())) {
                              setNewPrescription({ ...newPrescription, medication_name: value, medication_id: '' })
                            }
                          }}
                          onFocus={() => {
                            // Show dropdown when focused
                            if (medicineSearchTerm && filteredMedicines.length > 0) {
                              // Dropdown will show via Select component
                            }
                          }}
                        />
                        {medicineSearchTerm && filteredMedicines.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                            {filteredMedicines.map((medicine) => (
                              <div
                                key={medicine.id}
                                className="px-4 py-2 hover:bg-accent cursor-pointer border-b last:border-0"
                                onClick={() => {
                                  handleMedicineSelect(medicine.id)
                                }}
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{medicine.name}</p>
                                    {medicine.generic_name && (
                                      <p className="text-sm text-muted-foreground">{medicine.generic_name}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      {medicine.strength} {medicine.dosage_form}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    {medicine.current_stock !== undefined && (
                                      <Badge
                                        variant={medicine.current_stock === 0 ? "destructive" : medicine.current_stock < 10 ? "default" : "outline"}
                                        className="text-xs"
                                      >
                                        {medicine.current_stock === 0 ? 'Out of Stock' :
                                          medicine.current_stock < 10 ? `Low Stock (${medicine.current_stock})` :
                                            `In Stock (${medicine.current_stock})`}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {newPrescription.medication_id && (
                        <p className="text-xs text-muted-foreground">
                          Selected from catalog. Stock: {
                            medicines.find(m => m.id === newPrescription.medication_id)?.current_stock ?? 'Unknown'
                          } units
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Dosage *</Label>
                      <Input
                        placeholder="e.g., 500mg"
                        value={newPrescription.dosage}
                        onChange={(e) => setNewPrescription({ ...newPrescription, dosage: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Frequency *</Label>
                      <Select
                        value={newPrescription.frequency}
                        onValueChange={(value) => setNewPrescription({ ...newPrescription, frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Once daily">Once daily</SelectItem>
                          <SelectItem value="Twice daily">Twice daily</SelectItem>
                          <SelectItem value="Three times daily">Three times daily</SelectItem>
                          <SelectItem value="Four times daily">Four times daily</SelectItem>
                          <SelectItem value="Every 8 hours">Every 8 hours</SelectItem>
                          <SelectItem value="As needed">As needed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (days)</Label>
                      <Input
                        type="number"
                        value={newPrescription.duration_days}
                        onChange={(e) => setNewPrescription({ ...newPrescription, duration_days: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Instructions</Label>
                      <Textarea
                        placeholder="Special instructions..."
                        value={newPrescription.instructions}
                        onChange={(e) => setNewPrescription({ ...newPrescription, instructions: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                  <Button onClick={addPrescription} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Prescription
                  </Button>

                  {prescriptions.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label>Prescribed Medications ({prescriptions.length})</Label>
                        {prescriptions.map((rx, index) => (
                          <Card key={index}>
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <p className="font-semibold">{rx.medication_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {rx.dosage} - {rx.frequency} for {rx.duration_days} days
                                  </p>
                                  {rx.instructions && (
                                    <p className="text-sm italic">{rx.instructions}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePrescription(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Lab Tests Tab */}
            <TabsContent value="lab-tests" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lab Test Orders</CardTitle>
                  <CardDescription>Order laboratory tests for this patient</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Test Type *</Label>
                      <Select
                        value={newLabOrder.test_type}
                        onValueChange={(value) => setNewLabOrder({ ...newLabOrder, test_type: value, test_name: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select test type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CBC">Complete Blood Count (CBC)</SelectItem>
                          <SelectItem value="Urinalysis">Urinalysis</SelectItem>
                          <SelectItem value="Blood Glucose">Blood Glucose</SelectItem>
                          <SelectItem value="Lipid Profile">Lipid Profile</SelectItem>
                          <SelectItem value="Liver Function">Liver Function Test</SelectItem>
                          <SelectItem value="Kidney Function">Kidney Function Test</SelectItem>
                          <SelectItem value="Thyroid Function">Thyroid Function Test</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Test Name *</Label>
                      <Input
                        placeholder="e.g., Complete Blood Count"
                        value={newLabOrder.test_name}
                        onChange={(e) => setNewLabOrder({ ...newLabOrder, test_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={newLabOrder.priority}
                        onValueChange={(value: 'routine' | 'urgent' | 'stat') => setNewLabOrder({ ...newLabOrder, priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="routine">Routine</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="stat">STAT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sample Type</Label>
                      <Select
                        value={newLabOrder.sample_type}
                        onValueChange={(value) => setNewLabOrder({ ...newLabOrder, sample_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select sample type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="blood">Blood</SelectItem>
                          <SelectItem value="urine">Urine</SelectItem>
                          <SelectItem value="stool">Stool</SelectItem>
                          <SelectItem value="sputum">Sputum</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Clinical Indication</Label>
                      <Textarea
                        placeholder="Reason for ordering this test..."
                        value={newLabOrder.clinical_indication}
                        onChange={(e) => setNewLabOrder({ ...newLabOrder, clinical_indication: e.target.value })}
                        rows={2}
                      />
                    </div>
                  </div>
                  <Button onClick={addLabOrder} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Lab Test Order
                  </Button>

                  {labOrders.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label>Ordered Lab Tests ({labOrders.length})</Label>
                        {labOrders.map((order, index) => (
                          <Card key={index}>
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold">{order.test_name}</p>
                                    <Badge variant={order.priority === 'stat' ? 'destructive' : order.priority === 'urgent' ? 'default' : 'secondary'}>
                                      {order.priority.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    Type: {order.test_type}
                                    {order.sample_type && ` • Sample: ${order.sample_type}`}
                                  </p>
                                  {order.clinical_indication && (
                                    <p className="text-sm italic">{order.clinical_indication}</p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLabOrder(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Services Tab */}
            <TabsContent value="services" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Services & Procedures</CardTitle>
                  <CardDescription>Select services to bill for this consultation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-3">
                    {services.map((service) => (
                      <Card
                        key={service.id}
                        className={`cursor-pointer transition-colors ${selectedServices.includes(service.id) ? 'border-primary bg-primary/5' : ''
                          }`}
                        onClick={() => toggleService(service.id)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{service.service_name}</p>
                                {service.sha_approved && (
                                  <Badge variant="outline" className="text-xs">SHA Approved</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{service.service_code}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">KES {service.unit_price.toFixed(2)}</p>
                              <Badge variant={service.category === 'consultation' ? 'default' : 'secondary'}>
                                {service.category}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              {currentConsultationId ? (
                <NotesPanel
                  resourceType="consultation"
                  resourceId={currentConsultationId}
                  title="Consultation Notes"
                  showAddButton={true}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Save the consultation first to add notes.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Patient History Sidebar - 1 column */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <PatientHistoryPanel
              patientId={patientInfo?.id || consultationData.patient_id || "PAT-2025-0001"}
              compact={true}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsultationModule
