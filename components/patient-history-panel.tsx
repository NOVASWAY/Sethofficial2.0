'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  AlertTriangle, Calendar, FileText, Pill, Activity,
  Stethoscope, TrendingUp, AlertCircle
} from 'lucide-react'
import { usePatient, type Allergy, type Consultation } from '@/contexts/patient-context'

interface PatientHistoryPanelProps {
  patientId: string
  compact?: boolean
}

export function PatientHistoryPanel({ patientId, compact = false }: PatientHistoryPanelProps) {
  const { getPatientData, getPatientAllergies, getPatientConsultations } = usePatient()
  
  const patientData = getPatientData(patientId)
  const allergies = getPatientAllergies(patientId)
  const consultations = getPatientConsultations(patientId)

  if (!patientData) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No medical history available for this patient
        </AlertDescription>
      </Alert>
    )
  }

  const getSeverityColor = (severity: Allergy['severity']) => {
    switch (severity) {
      case 'life-threatening':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'severe':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'mild':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  if (compact) {
    // Compact view for sidebars
    return (
      <div className="space-y-4">
        {/* Allergy Warnings - Always visible if present */}
        {allergies.length > 0 && (
          <Alert className="border-red-500 bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <AlertDescription>
              <div className="font-semibold text-red-900 mb-2">⚠️ ALLERGY ALERTS</div>
              <div className="space-y-1">
                {allergies.map(allergy => (
                  <div key={allergy.id} className="text-sm">
                    <span className="font-semibold">{allergy.allergen}</span>
                    <span className="text-red-700"> ({allergy.severity})</span>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Quick Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {patientData.bloodType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Blood Type:</span>
                <span className="font-semibold">{patientData.bloodType}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allergies:</span>
              <Badge variant={allergies.length > 0 ? 'destructive' : 'outline'}>
                {allergies.length}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Past Visits:</span>
              <span className="font-semibold">{consultations.length}</span>
            </div>
            {patientData.chronicConditions && patientData.chronicConditions.length > 0 && (
              <div>
                <span className="text-muted-foreground">Chronic Conditions:</span>
                <div className="mt-1 space-y-1">
                  {patientData.chronicConditions.map((condition, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs mr-1">
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Consultation */}
        {consultations.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Last Visit
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(consultations[0].date).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-semibold">Diagnosis: </span>
                  {consultations[0].diagnosis}
                </div>
                {consultations[0].prescriptions.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {consultations[0].prescriptions.length} prescription(s)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // Full view for dedicated history pages
  return (
    <div className="space-y-6">
      {/* Allergy Warnings */}
      {allergies.length > 0 && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <AlertDescription>
            <div className="font-bold text-red-900 text-lg mb-3">⚠️ ALLERGY ALERTS - {allergies.length}</div>
            <div className="space-y-3">
              {allergies.map(allergy => (
                <div 
                  key={allergy.id} 
                  className={`p-3 rounded border-2 ${getSeverityColor(allergy.severity)}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg">{allergy.allergen}</span>
                    <Badge variant="outline" className={getSeverityColor(allergy.severity)}>
                      {allergy.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm mb-1">
                    <span className="font-semibold">Reaction: </span>
                    {allergy.reaction}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Recorded: {new Date(allergy.recordedDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Patient Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Patient Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {patientData.bloodType && (
              <div>
                <div className="text-sm text-muted-foreground">Blood Type</div>
                <div className="text-lg font-semibold">{patientData.bloodType}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground">Known Allergies</div>
              <div className="text-lg font-semibold">{allergies.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Visits</div>
              <div className="text-lg font-semibold">{consultations.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Visit</div>
              <div className="text-lg font-semibold">
                {consultations.length > 0
                  ? new Date(consultations[0].date).toLocaleDateString()
                  : 'No visits'}
              </div>
            </div>
          </div>

          {patientData.chronicConditions && patientData.chronicConditions.length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <div className="text-sm text-muted-foreground mb-2">Chronic Conditions</div>
                <div className="flex flex-wrap gap-2">
                  {patientData.chronicConditions.map((condition, idx) => (
                    <Badge key={idx} variant="outline" className="text-sm">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Consultation History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Consultation History ({consultations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {consultations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Stethoscope className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No previous consultations</p>
            </div>
          ) : (
            <div className="space-y-4">
              {consultations.map((consultation, idx) => (
                <div key={consultation.id}>
                  {idx > 0 && <Separator className="my-4" />}
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-lg">{consultation.diagnosis}</div>
                        <div className="text-sm text-muted-foreground">
                          {consultation.consultationNumber}
                          {consultation.icdCode && ` • ICD: ${consultation.icdCode}`}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {new Date(consultation.date).toLocaleDateString()}
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Clinician: </span>
                        <span className="font-medium">{consultation.clinicianName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Chief Complaint: </span>
                        <span className="font-medium">{consultation.chiefComplaint}</span>
                      </div>
                    </div>

                    {/* Vital Signs */}
                    {consultation.vitalSigns && (
                      <div className="p-3 bg-muted rounded-lg">
                        <div className="font-semibold text-sm mb-2">Vital Signs</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {consultation.vitalSigns.temperature && (
                            <div>Temp: {consultation.vitalSigns.temperature}</div>
                          )}
                          {consultation.vitalSigns.bloodPressure && (
                            <div>BP: {consultation.vitalSigns.bloodPressure}</div>
                          )}
                          {consultation.vitalSigns.heartRate && (
                            <div>HR: {consultation.vitalSigns.heartRate} bpm</div>
                          )}
                          {consultation.vitalSigns.respiratoryRate && (
                            <div>RR: {consultation.vitalSigns.respiratoryRate}/min</div>
                          )}
                          {consultation.vitalSigns.oxygenSaturation && (
                            <div>SpO2: {consultation.vitalSigns.oxygenSaturation}</div>
                          )}
                          {consultation.vitalSigns.weight && (
                            <div>Weight: {consultation.vitalSigns.weight}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Prescriptions */}
                    {consultation.prescriptions.length > 0 && (
                      <div>
                        <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <Pill className="h-4 w-4" />
                          Prescriptions ({consultation.prescriptions.length})
                        </div>
                        <div className="space-y-2">
                          {consultation.prescriptions.map(prescription => (
                            <div 
                              key={prescription.id} 
                              className="p-2 border rounded text-sm"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-medium">{prescription.medicationName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {prescription.dosage} • {prescription.frequency} • {prescription.duration}
                                  </div>
                                  {prescription.instructions && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {prescription.instructions}
                                    </div>
                                  )}
                                </div>
                                <Badge 
                                  variant={prescription.status === 'dispensed' ? 'default' : 'outline'}
                                  className="text-xs"
                                >
                                  {prescription.status}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {consultation.notes && (
                      <div className="text-sm">
                        <span className="font-semibold">Clinical Notes: </span>
                        <span className="text-muted-foreground">{consultation.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

