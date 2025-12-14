"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Stethoscope, User, Clock, FileText, Search, Plus, Activity, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { consultationAPI, patientAPI } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { useParams } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface Visit {
  id: string
  patientName: string
  patientId: string
  visitDate: string
  visitTime: string
  chiefComplaint: string
  diagnosis: string
  clinician: string
  status: string
  vitals: {
    bp: string
    pulse: string
    temp: string
    weight: string
  }
}

interface ConsultationAPIResponse {
  id: string
  patient_id: string
  patient_name?: string
  patient_first_name?: string
  patient_last_name?: string
  date?: string
  time?: string
  created_at?: string
  chief_complaint?: string
  diagnosis?: string
  doctor_name?: string
  clinician_name?: string
  status?: string
  vital_signs?: {
    blood_pressure?: string
    bp?: string
    pulse?: number | string
    temperature?: number | string
    weight?: number | string
  }
}

interface PatientAPIResponse {
  id: string
  first_name?: string
  last_name?: string
  patient_number?: string
  [key: string]: unknown
}

export default function VisitsPage() {
  const params = useParams()
  const role = params.role as string
  const { toast } = useToast()
  const [isNewVisitOpen, setIsNewVisitOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [visits, setVisits] = useState<Visit[]>([])
  const [patients, setPatients] = useState<PatientAPIResponse[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch consultations (visits) from API
  useEffect(() => {
    const fetchVisits = async () => {
      try {
        setLoading(true)
        const result: any = await consultationAPI.getAll({ page: 1, per_page: 100 })
        
        // Handle nested data structure: result.data.data contains the array
        const consultationsArray = result?.data?.data || (Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []))
        
        if (consultationsArray && Array.isArray(consultationsArray) && consultationsArray.length > 0) {
          // Transform API response to match visit interface
          const transformed = consultationsArray.map((consult: ConsultationAPIResponse): Visit => ({
            id: consult.id || `CONS-${Math.random().toString(36).substr(2, 9)}`,
            patientName: consult.patient_name || `${consult.patient_first_name || ''} ${consult.patient_last_name || ''}`.trim() || 'Unknown Patient',
            patientId: consult.patient_id || '',
            visitDate: consult.date || consult.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
            visitTime: consult.time || consult.created_at?.split('T')[1]?.substring(0, 5) || new Date().toTimeString().substring(0, 5),
            chiefComplaint: consult.chief_complaint || consult.chief_complaint || 'N/A',
            diagnosis: consult.diagnosis || 'Pending diagnosis',
            clinician: consult.doctor_name || consult.clinician_name || 'Unknown',
            status: consult.status || (consult.diagnosis ? 'completed' : 'in-progress'),
            vitals: {
              bp: consult.vital_signs?.blood_pressure || consult.vital_signs?.bp || 'N/A',
              pulse: consult.vital_signs?.pulse ? String(consult.vital_signs.pulse) : 'N/A',
              temp: consult.vital_signs?.temperature ? `${consult.vital_signs.temperature}°C` : 'N/A',
              weight: consult.vital_signs?.weight ? `${consult.vital_signs.weight}kg` : 'N/A',
            },
          }))
          setVisits(transformed)
        } else {
          // No data available - show empty state
          setVisits([])
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load visits. Please try again or check your connection.",
          variant: "destructive"
        })
        // Show empty state instead of mock data
        setVisits([])
      } finally {
        setLoading(false)
      }
    }

    fetchVisits()
  }, [toast])

  // Fetch patients for new visit dialog
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const result = await patientAPI.getAll({ page: 1, per_page: 100 })
        if (result && Array.isArray(result.data)) {
          setPatients(result.data)
        }
      } catch (error) {
        // Silently fail - patients dropdown will show "No patients available"
      }
    }
    fetchPatients()
  }, [])

  const handleNewVisit = () => {
    setIsNewVisitOpen(true)
  }

  const handleContinueVisit = (visitId: string) => {
    // Navigate to visit details or start visit workflow
    toast({
      title: "Visit",
      description: "Continuing visit workflow...",
    })
  }

  const handleViewNotes = (visitId: string) => {
    // Open notes dialog or navigate to notes page
    toast({
      title: "Visit Notes",
      description: "Opening visit notes...",
    })
  }

  const handleViewDetails = (visitId: string) => {
    // Open visit details dialog
    toast({
      title: "Visit Details",
      description: "Opening visit details...",
    })
  }


  const filteredVisits = visits.filter(
    (visit) =>
      visit.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      visit.chiefComplaint.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-yellow-500"
      case "in-progress":
        return "bg-blue-500"
      case "completed":
        return "bg-green-500"
      case "cancelled":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Patient Visits</h1>
            <p className="text-muted-foreground">Manage patient visits and clinical encounters</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  setLoading(true)
                  const result: any = await consultationAPI.getAll({ page: 1, per_page: 100 })
                  // Handle nested data structure: result.data.data contains the array
                  const consultationsArray = result?.data?.data || (Array.isArray(result?.data) ? result.data : (Array.isArray(result) ? result : []))
                  
                  if (consultationsArray && Array.isArray(consultationsArray) && consultationsArray.length > 0) {
                    const transformed = consultationsArray.map((consult: ConsultationAPIResponse): Visit => ({
                      id: consult.id || `CONS-${Math.random().toString(36).substr(2, 9)}`,
                      patientName: consult.patient_name || `${consult.patient_first_name || ''} ${consult.patient_last_name || ''}`.trim() || 'Unknown Patient',
                      patientId: consult.patient_id || '',
                      visitDate: consult.date || consult.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
                      visitTime: consult.time || consult.created_at?.split('T')[1]?.substring(0, 5) || new Date().toTimeString().substring(0, 5),
                      chiefComplaint: consult.chief_complaint || 'N/A',
                      diagnosis: consult.diagnosis || 'Pending diagnosis',
                      clinician: consult.doctor_name || consult.clinician_name || 'Unknown',
                      status: consult.status || (consult.diagnosis ? 'completed' : 'in-progress'),
                      vitals: {
                        bp: consult.vital_signs?.blood_pressure || consult.vital_signs?.bp || 'N/A',
                        pulse: consult.vital_signs?.pulse ? String(consult.vital_signs.pulse) : 'N/A',
                        temp: consult.vital_signs?.temperature ? `${consult.vital_signs.temperature}°C` : 'N/A',
                        weight: consult.vital_signs?.weight ? `${consult.vital_signs.weight}kg` : 'N/A',
                      },
                    }))
                    setVisits(transformed)
                    toast({
                      title: "Refreshed",
                      description: "Visit data has been refreshed.",
                    })
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to refresh visits.",
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
            <Button onClick={handleNewVisit}>
              <Plus className="w-4 h-4 mr-2" />
              New Visit
            </Button>
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active">Active Visits</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="all">All Visits</TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search visits..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <TabsContent value="active" className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading visits...</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredVisits
                  .filter((visit) => visit.status !== "completed")
                  .map((visit) => (
                  <Card key={visit.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{visit.patientName}</span>
                              <Badge variant="outline">{visit.patientId}</Badge>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{visit.visitTime}</span>
                            </div>
                            <Badge className={getStatusColor(visit.status)}>{visit.status}</Badge>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <span className="text-sm font-medium">Chief Complaint:</span>
                              <p className="text-sm text-muted-foreground">{visit.chiefComplaint}</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium">Clinician:</span>
                              <span className="text-sm text-muted-foreground ml-2">{visit.clinician}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6 text-sm">
                            <div className="flex items-center space-x-1">
                              <Activity className="w-4 h-4 text-muted-foreground" />
                              <span>BP: {visit.vitals.bp}</span>
                            </div>
                            <div>Pulse: {visit.vitals.pulse}</div>
                            <div>Temp: {visit.vitals.temp}</div>
                            <div>Weight: {visit.vitals.weight}</div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewNotes(visit.id)}>
                            <FileText className="w-4 h-4 mr-2" />
                            Notes
                          </Button>
                          <Button size="sm" onClick={() => handleContinueVisit(visit.id)}>
                            <Stethoscope className="w-4 h-4 mr-2" />
                            Continue Visit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            <div className="grid gap-4">
              {filteredVisits
                .filter((visit) => visit.status === "completed")
                .map((visit) => (
                  <Card key={visit.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-4">
                            <span className="font-medium">{visit.patientName}</span>
                            <Badge variant="outline">{visit.patientId}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {visit.visitDate} at {visit.visitTime}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Diagnosis:</span>
                            <span className="text-sm text-muted-foreground ml-2">{visit.diagnosis}</span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Clinician:</span>
                            <span className="text-sm text-muted-foreground ml-2">{visit.clinician}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(visit.status)}>{visit.status}</Badge>
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(visit.id)}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading visits...</p>
                </CardContent>
              </Card>
            ) : filteredVisits.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-muted-foreground">No visits found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredVisits.map((visit) => (
                  <Card key={visit.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-4">
                            <span className="font-medium">{visit.patientName}</span>
                            <Badge variant="outline">{visit.patientId}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {visit.visitDate} at {visit.visitTime}
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Chief Complaint:</span>
                            <span className="text-sm text-muted-foreground ml-2">{visit.chiefComplaint}</span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Diagnosis:</span>
                            <span className="text-sm text-muted-foreground ml-2">{visit.diagnosis}</span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Clinician:</span>
                            <span className="text-sm text-muted-foreground ml-2">{visit.clinician}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getStatusColor(visit.status)}>{visit.status}</Badge>
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(visit.id)}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Visit Dialog */}
      <Dialog open={isNewVisitOpen} onOpenChange={setIsNewVisitOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start New Patient Visit</DialogTitle>
            <DialogDescription>Begin a new clinical encounter</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Patient</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Search and select patient..." />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {String(patient.first_name || patient.firstName || '')} {String(patient.last_name || patient.lastName || '')} ({patient.id || patient.patient_number})
                    </SelectItem>
                  ))}
                  {patients.length === 0 && (
                    <SelectItem value="no-patients" disabled>No patients available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visit Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select visit type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consultation">Consultation</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="routine">Routine Check-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chief Complaint</Label>
              <Textarea placeholder="Enter patient's main concern..." rows={3} />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsNewVisitOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setIsNewVisitOpen(false)
                  toast({
                    title: "New Visit",
                    description: "Starting new visit workflow...",
                  })
                }}
              >
                Start Visit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
