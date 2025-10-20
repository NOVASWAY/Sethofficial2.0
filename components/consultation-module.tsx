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
  Heart, Thermometer, Scale, Ruler, Plus, X, Save, ArrowRight 
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePatient, type Consultation as PatientConsultation } from '@/contexts/patient-context'
import { PatientHistoryPanel } from './patient-history-panel'
import { useWorkflow } from '@/contexts/workflow-context'
import { useRouter } from 'next/navigation'

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

export function ConsultationModule() {
  const { toast } = useToast()
  const router = useRouter()
  const { checkMedicationAllergy, addConsultation } = usePatient()
  const { setPendingConsultation } = useWorkflow()
  const [activeTab, setActiveTab] = useState('vitals')
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  
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
  }, [])

  const loadServices = async () => {
    // TODO: Replace with actual API call
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
  }

  const handleVitalSignsChange = (name: keyof VitalSigns, value: any) => {
    setVitalSigns(prev => ({ ...prev, [name]: value }))
  }

  const handleConsultationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setConsultationData(prev => ({ ...prev, [name]: value }))
  }

  const addPrescription = () => {
    if (!newPrescription.medication_name || !newPrescription.dosage || !newPrescription.frequency) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: 'Please fill in all required prescription fields',
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

      addConsultation(consultationData.patient_id, patientConsultation)

      // Set to workflow context for billing
      setPendingConsultation(workflowData)

      // TODO: Replace with actual API call
      // const response = await fetch('/api/consultations', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(consultationPayload),
      // })

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-muted-foreground">Patient</Label>
              <p className="font-semibold">John Doe</p>
              <p className="text-sm text-muted-foreground">PAT-2025-0001</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Age / Gender</Label>
              <p className="font-semibold">35 years / Male</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Insurance</Label>
              <Badge variant="outline">SHA Member</Badge>
            </div>
            <div>
              <Label className="text-muted-foreground">Visit Date</Label>
              <p className="font-semibold">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="services">
            <Heart className="mr-2 h-4 w-4" />
            Services
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
                <Input
                  id="icd_11_codes"
                  name="icd_11_codes"
                  placeholder="e.g., 1A00, 1A01"
                  value={consultationData.icd_11_codes}
                  onChange={handleConsultationChange}
                />
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
                  <Input
                    placeholder="e.g., Amoxicillin"
                    value={newPrescription.medication_name}
                    onChange={(e) => setNewPrescription({...newPrescription, medication_name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dosage *</Label>
                  <Input
                    placeholder="e.g., 500mg"
                    value={newPrescription.dosage}
                    onChange={(e) => setNewPrescription({...newPrescription, dosage: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Frequency *</Label>
                  <Select 
                    value={newPrescription.frequency}
                    onValueChange={(value) => setNewPrescription({...newPrescription, frequency: value})}
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
                    onChange={(e) => setNewPrescription({...newPrescription, duration_days: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Instructions</Label>
                  <Textarea
                    placeholder="Special instructions..."
                    value={newPrescription.instructions}
                    onChange={(e) => setNewPrescription({...newPrescription, instructions: e.target.value})}
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
                    className={`cursor-pointer transition-colors ${
                      selectedServices.includes(service.id) ? 'border-primary bg-primary/5' : ''
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
      </Tabs>
        </div>

        {/* Patient History Sidebar - 1 column */}
        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <PatientHistoryPanel patientId="PAT-2025-0001" compact={true} />
          </div>
        </div>
      </div>
    </div>
  )
}

