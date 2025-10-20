"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  PatientListSkeleton, 
  Loading, 
  LoadingButton,
  FormLoadingOverlay 
} from '@/components/ui/loading'
import { ErrorDisplay, NetworkError, ServerError } from '@/components/ui/error-display'
import { useAsyncOperation, useDataFetching } from '@/hooks/use-async-operation'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { patientAPI } from '@/lib/api-client'
import { AppError } from '@/lib/error-handler'
import { Search, UserPlus, RefreshCw, AlertCircle } from 'lucide-react'

interface Patient {
  id: string
  first_name: string
  last_name: string
  phone: string
  location?: string
  date_of_birth: string
  gender: string
  created_at: string
}

interface EnhancedPatientListProps {
  onPatientSelect?: (patient: Patient) => void
  onAddPatient?: () => void
}

export function EnhancedPatientList({ 
  onPatientSelect, 
  onAddPatient 
}: EnhancedPatientListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  
  // Using the enhanced async operation hook
  const { state, fetchData, reset } = useDataFetching<Patient[]>()
  
  // Using the error handler hook for additional error management
  const { error: additionalError, clearError } = useErrorHandler()

  // Load patients on component mount
  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    await fetchData(
      () => patientAPI.getAll(),
      'EnhancedPatientList.loadPatients'
    )
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      await loadPatients()
      return
    }

    await fetchData(
      () => patientAPI.search(searchTerm),
      'EnhancedPatientList.search'
    )
  }

  const handleRefresh = async () => {
    clearError()
    await loadPatients()
  }

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient)
    onPatientSelect?.(patient)
  }

  const handleAddPatient = () => {
    onAddPatient?.()
  }

  // Filter patients based on search term (client-side fallback)
  const filteredPatients = state.data?.filter(patient => 
    patient.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm) ||
    (patient.location && patient.location.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || []

  // Calculate age from date of birth
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
      {/* Header with search and actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Patient Management
          </CardTitle>
          <CardDescription>
            Search and manage patient records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and action bar */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search patients by name, phone, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <LoadingButton
              loading={state.loading}
              onClick={handleSearch}
              loadingText="Searching..."
            >
              Search
            </LoadingButton>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={state.loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={handleAddPatient}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
          </div>

          {/* Error Display */}
          {state.error && (
            <ErrorDisplay
              error={state.error}
              onRetry={handleRefresh}
              variant="inline"
            />
          )}

          {/* Additional Error Display */}
          {additionalError && (
            <ErrorDisplay
              error={additionalError}
              onDismiss={clearError}
              variant="inline"
              showDismiss={true}
            />
          )}
        </CardContent>
      </Card>

      {/* Patient List */}
      <Card>
        <CardHeader>
          <CardTitle>Patients</CardTitle>
          <CardDescription>
            {state.loading 
              ? 'Loading patients...' 
              : `${filteredPatients.length} patient${filteredPatients.length !== 1 ? 's' : ''} found`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormLoadingOverlay loading={state.loading}>
            {state.loading ? (
              <PatientListSkeleton count={5} />
            ) : state.error ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  Failed to load patients. Please try again.
                </p>
                <Button onClick={handleRefresh}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? 'No patients found matching your search.' : 'No patients found.'}
                </p>
                {searchTerm ? (
                  <Button variant="outline" onClick={() => {
                    setSearchTerm('')
                    loadPatients()
                  }}>
                    Clear Search
                  </Button>
                ) : (
                  <Button onClick={handleAddPatient}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First Patient
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedPatient?.id === patient.id ? 'bg-primary/10 border-primary' : ''
                    }`}
                    onClick={() => handlePatientSelect(patient)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium">
                            {patient.first_name} {patient.last_name}
                          </h3>
                          <Badge variant="secondary">
                            {calculateAge(patient.date_of_birth)} years
                          </Badge>
                          <Badge variant="outline">
                            {patient.gender}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>📞 {patient.phone}</p>
                          {patient.location && (
                            <p>📍 {patient.location}</p>
                          )}
                          <p>📅 Registered: {new Date(patient.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <p>ID: {patient.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </FormLoadingOverlay>
        </CardContent>
      </Card>

      {/* Selected Patient Details */}
      {selectedPatient && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Patient</CardTitle>
            <CardDescription>
              Details for {selectedPatient.first_name} {selectedPatient.last_name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                <p>{selectedPatient.first_name} {selectedPatient.last_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Age</p>
                <p>{calculateAge(selectedPatient.date_of_birth)} years</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p>{selectedPatient.phone}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gender</p>
                <p>{selectedPatient.gender}</p>
              </div>
              {selectedPatient.location && (
                <div className="col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p>{selectedPatient.location}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Example of how to wrap the component with error boundary
export const EnhancedPatientListWithErrorBoundary = withErrorBoundary(
  EnhancedPatientList,
  { context: 'PatientList' }
)
