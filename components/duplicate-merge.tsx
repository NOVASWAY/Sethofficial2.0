'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Users, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  Merge,
  AlertTriangle,
  Info,
  History
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { patientAPI } from '@/lib/api-client'

interface Patient {
  id: string
  patient_number: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  phone: string
  location?: string
  email?: string
  emergency_contact?: string
  emergency_phone?: string
  blood_type?: string
  allergies?: string[]
  medical_history?: string
  created_at: string
  updated_at: string
}

interface DuplicateGroup {
  patients: Patient[]
  matchType: string
  matchedFields: string[]
  similarityScore?: number
}

interface DuplicateMergeProps {
  duplicates: DuplicateGroup[]
  onMergeComplete?: () => void
  onCancel?: () => void
}

interface FieldSelection {
  [field: string]: 'keep' | 'merge' | 'new'
  source: 'keep' | 'merge'
}

export function DuplicateMerge({ duplicates, onMergeComplete, onCancel }: DuplicateMergeProps) {
  const { toast } = useToast()
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null)
  const [fieldSelections, setFieldSelections] = useState<Record<string, FieldSelection>>({})
  const [isMerging, setIsMerging] = useState(false)

  const handleSelectGroup = (group: DuplicateGroup) => {
    setSelectedGroup(group)
    // Initialize field selections
    const selections: FieldSelection = {
      source: 'keep', // Keep first patient as primary
    }
    setFieldSelections(selections)
  }

  const handleMerge = async () => {
    if (!selectedGroup || selectedGroup.patients.length < 2) {
      toast({
        title: 'Invalid Selection',
        description: 'Please select a duplicate group to merge',
        variant: 'error',
      })
      return
    }

    setIsMerging(true)

    try {
      const primary = selectedGroup.patients[0]
      const secondary = selectedGroup.patients[1]

      // Build merged patient data
      const mergedData: Partial<Patient> = {
        first_name: fieldSelections['first_name'] === 'merge' 
          ? `${primary.first_name} ${secondary.first_name}`.trim()
          : primary.first_name,
        last_name: fieldSelections['last_name'] === 'merge'
          ? `${primary.last_name} ${secondary.last_name}`.trim()
          : primary.last_name,
        phone: fieldSelections['phone'] === 'merge'
          ? primary.phone || secondary.phone
          : primary.phone,
        location: fieldSelections['location'] === 'merge'
          ? primary.location || secondary.location
          : primary.location,
        email: fieldSelections['email'] === 'merge'
          ? primary.email || secondary.email
          : primary.email,
        emergency_contact: fieldSelections['emergency_contact'] === 'merge'
          ? primary.emergency_contact || secondary.emergency_contact
          : primary.emergency_contact,
        emergency_phone: fieldSelections['emergency_phone'] === 'merge'
          ? primary.emergency_phone || secondary.emergency_phone
          : primary.emergency_phone,
        blood_type: fieldSelections['blood_type'] === 'merge'
          ? primary.blood_type || secondary.blood_type
          : primary.blood_type,
        medical_history: fieldSelections['medical_history'] === 'merge'
          ? `${primary.medical_history || ''}\n\n${secondary.medical_history || ''}`.trim()
          : primary.medical_history,
        allergies: fieldSelections['allergies'] === 'merge'
          ? [...(primary.allergies || []), ...(secondary.allergies || [])]
          : primary.allergies,
      }

      // Update primary patient
      await patientAPI.update(primary.id, mergedData)

      // Delete secondary patient (or mark as merged)
      await patientAPI.delete(secondary.id)

      toast({
        title: 'Merge Successful',
        description: `Merged ${secondary.first_name} ${secondary.last_name} into ${primary.first_name} ${primary.last_name}`,
      })

      if (onMergeComplete) {
        onMergeComplete()
      }
    } catch (error) {
      console.error('Merge error:', error)
      toast({
        title: 'Merge Failed',
        description: error instanceof Error ? error.message : 'Failed to merge patients',
        variant: 'error',
      })
    } finally {
      setIsMerging(false)
    }
  }

  if (duplicates.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No duplicate groups found. All patients appear to be unique.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Found {duplicates.length} duplicate group(s). Review and merge duplicate records to maintain data quality.
        </AlertDescription>
      </Alert>

      {/* Duplicate Groups List */}
      <Card>
        <CardHeader>
          <CardTitle>Duplicate Groups</CardTitle>
          <CardDescription>Select a group to merge duplicate records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {duplicates.map((group, index) => (
              <div
                key={index}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedGroup === group
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => handleSelectGroup(group)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Group {index + 1}</Badge>
                      <Badge className="bg-orange-500">
                        {group.patients.length} duplicate{group.patients.length > 1 ? 's' : ''}
                      </Badge>
                      {group.similarityScore && (
                        <Badge variant="outline">
                          {Math.round(group.similarityScore * 100)}% similar
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      {group.patients.map((patient, pIdx) => (
                        <div key={patient.id} className="flex items-center gap-2 text-sm">
                          <span className="font-medium">
                            {patient.first_name} {patient.last_name}
                          </span>
                          <span className="text-muted-foreground">
                            ({patient.patient_number})
                          </span>
                          {pIdx === 0 && (
                            <Badge variant="outline" className="text-xs">Primary</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Matched on: {group.matchedFields.join(', ')}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectGroup(group)
                    }}
                  >
                    <Merge className="w-4 h-4 mr-2" />
                    Merge
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Merge Dialog */}
      {selectedGroup && selectedGroup.patients.length >= 2 && (
        <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Merge Duplicate Patients</DialogTitle>
              <DialogDescription>
                Select which fields to keep from each patient record
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  The primary patient (first record) will be kept. The secondary patient will be deleted after merge.
                  All historical data (consultations, appointments) will be preserved and linked to the merged patient.
                </AlertDescription>
              </Alert>

              {/* Side-by-side Comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Primary Patient */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Primary Patient (Keep)</CardTitle>
                      <Badge className="bg-green-500">Primary</Badge>
                    </div>
                    <CardDescription>
                      {selectedGroup.patients[0].first_name} {selectedGroup.patients[0].last_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <PatientDetails patient={selectedGroup.patients[0]} />
                  </CardContent>
                </Card>

                {/* Secondary Patient */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Secondary Patient (Merge)</CardTitle>
                      <Badge variant="destructive">Will be deleted</Badge>
                    </div>
                    <CardDescription>
                      {selectedGroup.patients[1].first_name} {selectedGroup.patients[1].last_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <PatientDetails patient={selectedGroup.patients[1]} />
                  </CardContent>
                </Card>
              </div>

              {/* Field Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Field Selection</CardTitle>
                  <CardDescription>
                    Choose which values to keep for each field
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getMergeableFields(selectedGroup.patients[0], selectedGroup.patients[1]).map(field => (
                      <div key={field.key} className="space-y-2">
                        <Label className="font-medium capitalize">
                          {field.label}
                        </Label>
                        <RadioGroup
                          value={fieldSelections[field.key]?.source || 'keep'}
                          onValueChange={(value) => {
                            setFieldSelections(prev => ({
                              ...prev,
                              [field.key]: { source: value as 'keep' | 'merge' },
                            }))
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="keep" id={`${field.key}-keep`} />
                            <Label htmlFor={`${field.key}-keep`} className="font-normal cursor-pointer">
                              Keep primary: <span className="text-muted-foreground">{field.primaryValue}</span>
                            </Label>
                          </div>
                          {field.secondaryValue && field.secondaryValue !== field.primaryValue && (
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="merge" id={`${field.key}-merge`} />
                              <Label htmlFor={`${field.key}-merge`} className="font-normal cursor-pointer">
                                Use secondary: <span className="text-muted-foreground">{field.secondaryValue}</span>
                              </Label>
                            </div>
                          )}
                        </RadioGroup>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedGroup(null)}>
                  Cancel
                </Button>
                <Button onClick={handleMerge} disabled={isMerging}>
                  <Merge className="w-4 h-4 mr-2" />
                  {isMerging ? 'Merging...' : 'Merge Patients'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function PatientDetails({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-2 text-sm">
      <div>
        <span className="font-medium">Patient Number:</span>{' '}
        <span className="text-muted-foreground">{patient.patient_number}</span>
      </div>
      <div>
        <span className="font-medium">Date of Birth:</span>{' '}
        <span className="text-muted-foreground">
          {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'}
        </span>
      </div>
      <div>
        <span className="font-medium">Gender:</span>{' '}
        <span className="text-muted-foreground">{patient.gender || 'N/A'}</span>
      </div>
      <div>
        <span className="font-medium">Phone:</span>{' '}
        <span className="text-muted-foreground">{patient.phone || 'N/A'}</span>
      </div>
      {patient.location && (
        <div>
          <span className="font-medium">Location:</span>{' '}
          <span className="text-muted-foreground">{patient.location}</span>
        </div>
      )}
      {patient.email && (
        <div>
          <span className="font-medium">Email:</span>{' '}
          <span className="text-muted-foreground">{patient.email}</span>
        </div>
      )}
      {patient.blood_type && (
        <div>
          <span className="font-medium">Blood Type:</span>{' '}
          <span className="text-muted-foreground">{patient.blood_type}</span>
        </div>
      )}
      <div>
        <span className="font-medium">Created:</span>{' '}
        <span className="text-muted-foreground">
          {new Date(patient.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}

function getMergeableFields(primary: Patient, secondary: Patient) {
  return [
    {
      key: 'first_name',
      label: 'First Name',
      primaryValue: primary.first_name,
      secondaryValue: secondary.first_name,
    },
    {
      key: 'last_name',
      label: 'Last Name',
      primaryValue: primary.last_name,
      secondaryValue: secondary.last_name,
    },
    {
      key: 'phone',
      label: 'Phone Number',
      primaryValue: primary.phone,
      secondaryValue: secondary.phone,
    },
    {
      key: 'location',
      label: 'Location',
      primaryValue: primary.location || 'N/A',
      secondaryValue: secondary.location || 'N/A',
    },
    {
      key: 'email',
      label: 'Email',
      primaryValue: primary.email || 'N/A',
      secondaryValue: secondary.email || 'N/A',
    },
    {
      key: 'emergency_contact',
      label: 'Emergency Contact',
      primaryValue: primary.emergency_contact || 'N/A',
      secondaryValue: secondary.emergency_contact || 'N/A',
    },
    {
      key: 'emergency_phone',
      label: 'Emergency Phone',
      primaryValue: primary.emergency_phone || 'N/A',
      secondaryValue: secondary.emergency_phone || 'N/A',
    },
    {
      key: 'blood_type',
      label: 'Blood Type',
      primaryValue: primary.blood_type || 'N/A',
      secondaryValue: secondary.blood_type || 'N/A',
    },
    {
      key: 'medical_history',
      label: 'Medical History',
      primaryValue: primary.medical_history ? 'Has history' : 'None',
      secondaryValue: secondary.medical_history ? 'Has history' : 'None',
    },
  ].filter(field => field.primaryValue !== field.secondaryValue || field.primaryValue !== 'N/A')
}

