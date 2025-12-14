'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  User, Calendar, Receipt, Pill, Stethoscope, Activity,
  TrendingUp, AlertCircle, CheckCircle2, Clock, FileText,
  ArrowLeft, Edit, Eye, FlaskConical
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { consultationAPI, invoiceAPI, prescriptionAPI, appointmentAPI, labAPI } from '@/lib/api-client'
import { LabResultViewer } from './lab-result-viewer'
import { NotesPanel } from './notes-panel'
import { usePatientEnhanced, type Patient } from '@/contexts/patient-context-enhanced'
import { VISIT_REASON_CATEGORIES, type VisitReasonCategory, categorizeVisitReason } from './registration-module'

interface PatientDashboardProps {
  patientId: string
  onBack?: () => void
}

export function PatientDashboard({ patientId, onBack }: PatientDashboardProps) {
  const router = useRouter()
  const { getPatientById } = usePatientEnhanced()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  // Data states
  const [consultations, setConsultations] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [selectedLabResult, setSelectedLabResult] = useState<string | null>(null)

  // Statistics
  const [stats, setStats] = useState({
    totalVisits: 0,
    totalSpent: 0,
    activePrescriptions: 0,
    upcomingAppointments: 0,
    lastVisit: null as Date | null,
    visitCategories: {} as Record<VisitReasonCategory, number>
  })

  useEffect(() => {
    loadPatientData()
  }, [patientId])

  const loadPatientData = async () => {
    setLoading(true)
    try {
      // Load patient
      const patientData = getPatientById(patientId)
      if (!patientData) {
        // Try to load from API if not in context
        const response = await fetch(`/api/patients/${patientId}`)
        if (response.ok) {
          const data = await response.json()
          setPatient(data)
        } else {
          throw new Error('Patient not found')
        }
      } else {
        setPatient(patientData)
      }

      // Load all related data
      const [consultationsData, invoicesData, prescriptionsData, appointmentsData, labResultsData] = await Promise.all([
        consultationAPI.getByPatientId(patientId).catch(() => ({ data: [] })),
        invoiceAPI.getAll({ patient_id: patientId }).catch(() => ({ data: [] })),
        prescriptionAPI.getAll({ patient_id: patientId }).catch(() => ({ data: [] })),
        appointmentAPI.getAll({ patient_id: patientId }).catch(() => ({ data: [] })),
        labAPI.getPatientResults(patientId).catch(() => []),
      ])

      const consultationsList = consultationsData?.data || []
      const invoicesList = invoicesData?.data || []
      const prescriptionsList = prescriptionsData?.data || []
      const appointmentsList = appointmentsData?.data || []
      const labResultsList = Array.isArray(labResultsData) ? labResultsData : []

      setConsultations(consultationsList)
      setInvoices(invoicesList)
      setPrescriptions(prescriptionsList)
      setAppointments(appointmentsList)
      setLabResults(labResultsList)

      // Calculate statistics
      const totalSpent = invoicesList.reduce((sum: number, inv: any) =>
        sum + parseFloat(inv.total_amount || inv.total || 0), 0
      )

      const activePrescriptions = prescriptionsList.filter((p: any) =>
        p.status === 'active' || p.status === 'pending'
      ).length

      const upcomingAppointments = appointmentsList.filter((a: any) => {
        const apptDate = new Date(a.date || a.appointment_date)
        return apptDate >= new Date() && (a.status === 'scheduled' || a.status === 'confirmed')
      }).length

      // Get last visit
      const sortedConsultations = [...consultationsList].sort((a, b) => {
        const dateA = new Date(a.visit_date || a.date || a.created_at || 0)
        const dateB = new Date(b.visit_date || b.date || b.created_at || 0)
        return dateB.getTime() - dateA.getTime()
      })
      const lastVisit = sortedConsultations.length > 0
        ? new Date(sortedConsultations[0].visit_date || sortedConsultations[0].date || sortedConsultations[0].created_at)
        : null

      // Categorize visits
      const visitCategories: Record<VisitReasonCategory, number> = {
        'follow-up': 0,
        'new-complaint': 0,
        'routine-check': 0,
        'emergency': 0,
        'medication-refill': 0,
        'lab-results': 0,
        'other': 0
      }

      consultationsList.forEach((consultation: any) => {
        const reason = consultation.chief_complaint || consultation.visit_reason || ''
        const category = categorizeVisitReason(reason)
        visitCategories[category] = (visitCategories[category] || 0) + 1
      })

      setStats({
        totalVisits: consultationsList.length,
        totalSpent,
        activePrescriptions,
        upcomingAppointments,
        lastVisit,
        visitCategories
      })
    } catch (error) {
      console.error('Error loading patient data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Activity className="h-12 w-12 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Loading patient dashboard...</p>
        </div>
      </div>
    )
  }

  if (!patient) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-semibold">Patient not found</p>
            <p className="text-muted-foreground mb-4">The patient you're looking for doesn't exist.</p>
            {onBack && (
              <Button onClick={onBack} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob)
    const today = new Date()
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
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <div>
              <h1 className="text-3xl font-bold">
                {patient.first_name} {patient.last_name}
              </h1>
              <p className="text-muted-foreground">
                {patient.patient_number} • {(patient as any).age || (patient.date_of_birth ? calculateAge(patient.date_of_birth) : 'N/A')} years • {patient.gender}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/receptionist/registration?patientId=${patient.id}`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Patient
          </Button>
          <Button variant="outline" onClick={() => router.push(`/dashboard/receptionist/consultation?patientId=${patient.id}`)}>
            <Stethoscope className="h-4 w-4 mr-2" />
            New Consultation
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVisits}</div>
            {stats.lastVisit && (
              <p className="text-xs text-muted-foreground">
                Last visit: {stats.lastVisit.toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">KSh {stats.totalSpent.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {invoices.length} invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Prescriptions</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePrescriptions}</div>
            <p className="text-xs text-muted-foreground">
              {prescriptions.length} total prescriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
            <p className="text-xs text-muted-foreground">
              {appointments.length} total appointments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visit Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Visit Patterns</CardTitle>
          <CardDescription>Distribution of visit reasons</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {VISIT_REASON_CATEGORIES.map((category) => {
              const count = stats.visitCategories[category.value] || 0
              return (
                <div key={category.value} className="text-center p-3 border rounded-lg">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{category.label}</div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Visits ({consultations.length})</TabsTrigger>
          <TabsTrigger value="billing">Billing ({invoices.length})</TabsTrigger>
          <TabsTrigger value="medications">Medications ({prescriptions.length})</TabsTrigger>
          <TabsTrigger value="lab-results">Lab Results ({labResults.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient Info */}
            <Card>
              <CardHeader>
                <CardTitle>Patient Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-muted-foreground text-sm">Phone</Label>
                  <p className="font-medium">{patient.phone}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Location</Label>
                  <p className="font-medium">{patient.address || 'Not provided'}</p>
                </div>
                {patient.blood_type && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Blood Type</Label>
                    <Badge variant="secondary">{patient.blood_type}</Badge>
                  </div>
                )}
                {patient.insurance_type && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Insurance</Label>
                    <p className="font-medium">{patient.insurance_type}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {consultations.slice(0, 3).map((consultation: any) => (
                    <div key={consultation.id} className="flex items-start gap-3 p-2 border rounded">
                      <Stethoscope className="h-4 w-4 mt-1 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {consultation.chief_complaint || 'Consultation'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(consultation.visit_date || consultation.date || consultation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {consultations.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="visits" className="space-y-4">
          <div className="space-y-2">
            {consultations.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No consultations found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              consultations.map((consultation: any) => {
                const category = categorizeVisitReason(consultation.chief_complaint || '')
                return (
                  <Card key={consultation.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{consultation.consultation_number || consultation.id}</Badge>
                            <Badge variant="secondary">
                              {VISIT_REASON_CATEGORIES.find(c => c.value === category)?.label || 'Other'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(consultation.visit_date || consultation.date || consultation.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="font-medium text-sm mb-1">
                            {consultation.chief_complaint || 'No chief complaint recorded'}
                          </p>
                          {consultation.diagnosis && (
                            <p className="text-sm text-muted-foreground">
                              Diagnosis: {consultation.diagnosis}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <div className="space-y-2">
            {invoices.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No invoices found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              invoices.map((invoice: any) => {
                const paymentMethod = invoice.payment_method || invoice.paymentMethod || 'pending'
                const paymentMethodLabels: Record<string, string> = {
                  'cash': 'Cash',
                  'mpesa': 'M-Pesa',
                  'sha': 'SHA',
                  'bank-transfer': 'Bank Transfer',
                  'mixed': 'Mixed',
                  'pending': 'Pending'
                }

                return (
                  <Card key={invoice.id} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{invoice.invoice_number || invoice.id}</Badge>
                            <Badge variant={invoice.payment_status === 'paid' ? 'default' : 'secondary'}>
                              {invoice.payment_status || 'pending'}
                            </Badge>
                            {paymentMethod !== 'pending' && (
                              <Badge variant="outline" className="text-xs">
                                {paymentMethodLabels[paymentMethod.toLowerCase()] || paymentMethod}
                              </Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              {new Date(invoice.created_at || invoice.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="font-medium text-sm">
                            KSh {parseFloat(invoice.total_amount || invoice.total || 0).toLocaleString()}
                          </p>
                          {invoice.amount_paid && invoice.total_amount && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Paid: KSh {parseFloat(invoice.amount_paid || 0).toLocaleString()} /
                              Balance: KSh {(parseFloat(invoice.total_amount) - parseFloat(invoice.amount_paid || 0)).toLocaleString()}
                            </p>
                          )}
                          {invoice.consultation_id && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Consultation: {invoice.consultation_id}
                            </p>
                          )}
                          {invoice.mpesa_transaction_code && (
                            <p className="text-xs text-muted-foreground mt-1">
                              M-Pesa: {invoice.mpesa_transaction_code}
                            </p>
                          )}
                          {invoice.sha_claim_number && (
                            <p className="text-xs text-muted-foreground mt-1">
                              SHA Claim: {invoice.sha_claim_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="medications" className="space-y-4">
          <div className="space-y-2">
            {prescriptions.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">No prescriptions found</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              prescriptions.map((prescription: any) => (
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Lab Results Tab */}
        <TabsContent value="lab-results" className="space-y-4">
          {selectedLabResult ? (
            <div className="space-y-4">
              <Button variant="outline" onClick={() => setSelectedLabResult(null)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Results
              </Button>
              <LabResultViewer
                resultId={selectedLabResult}
                showActions={false}
                onBack={() => setSelectedLabResult(null)}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Lab Test Results</CardTitle>
                  <CardDescription>
                    View all laboratory test results for this patient
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {labResults.length === 0 ? (
                    <div className="text-center py-8">
                      <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground">No lab test results found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {labResults.map((result: any) => (
                        <Card
                          key={result.id}
                          className="border-l-4 border-l-blue-500 cursor-pointer hover:bg-accent transition-colors"
                          onClick={() => setSelectedLabResult(result.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant={
                                    result.status === 'reviewed' ? 'default' :
                                      result.status === 'verified' ? 'default' :
                                        'secondary'
                                  }>
                                    {result.status || 'pending'}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {new Date(result.result_date).toLocaleDateString()}
                                  </span>
                                </div>
                                <p className="font-medium text-sm">
                                  {result.test_name || result.test_type}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Result #: {result.result_number}
                                </p>
                                {result.verified_at && (
                                  <p className="text-xs text-muted-foreground">
                                    Verified: {new Date(result.verified_at).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <NotesPanel
            resourceType="patient"
            resourceId={patientId}
            title="Patient Notes"
            showAddButton={true}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

