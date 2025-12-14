"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  LoadingButton,
  FormLoadingOverlay
} from '@/components/ui/loading'
import { ErrorDisplay, ValidationError } from '@/components/ui/error-display'
import { useFormSubmission } from '@/hooks/use-async-operation'
import { useErrorHandler } from '@/hooks/use-error-handler'
import { patientAPI } from '@/lib/api-client'
import { validateForm, validationSchemas } from '@/lib/validation'
import { UserPlus, Save, X, AlertCircle } from 'lucide-react'
import { withErrorBoundary } from '@/components/error-boundary'

interface PatientFormData {
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string
  phone: string
  location: string
  emergency_contact: string
  emergency_phone: string
  blood_type: string
  medical_history: string
}

interface EnhancedPatientFormProps {
  initialData?: Partial<PatientFormData>
  onSuccess?: (patient: any) => void
  onCancel?: () => void
  mode?: 'create' | 'edit'
}

export function EnhancedPatientForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create'
}: EnhancedPatientFormProps) {
  const [formData, setFormData] = useState<PatientFormData>({
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    date_of_birth: initialData?.date_of_birth || '',
    gender: initialData?.gender || '',
    phone: initialData?.phone || '',
    location: initialData?.location || '',
    emergency_contact: initialData?.emergency_contact || '',
    emergency_phone: initialData?.emergency_phone || '',
    blood_type: initialData?.blood_type || '',
    medical_history: initialData?.medical_history || '',
  })

  const [validationErrors, setValidationErrors] = useState<any[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Using the form submission hook
  const { loading, error, submit, reset } = useFormSubmission()

  // Using the error handler hook for additional error management
  const { error: additionalError, clearError } = useErrorHandler()

  const handleInputChange = (field: keyof PatientFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Clear field-specific error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const validateFormData = (): boolean => {
    try {
      // Convert form data to match validation schema format
      const validationData = {
        firstName: formData.first_name,
        lastName: formData.last_name,
        dateOfBirth: formData.date_of_birth,
        gender: formData.gender,
        phone: formData.phone,
        location: formData.location,
        emergencyContact: formData.emergency_contact,
        emergencyPhone: formData.emergency_phone,
      }

      const validationResult = validateForm(validationData, validationSchemas.patient)

      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors)

        // Convert validation errors to field errors
        const fieldErrorMap: Record<string, string> = {}
        validationResult.errors.forEach(error => {
          if (error.field) {
            // Map validation field names to form field names
            const formField = error.field === 'firstName' ? 'first_name' :
              error.field === 'lastName' ? 'last_name' :
                error.field === 'dateOfBirth' ? 'date_of_birth' :
                  error.field === 'emergencyContact' ? 'emergency_contact' :
                    error.field === 'emergencyPhone' ? 'emergency_phone' :
                      error.field
            fieldErrorMap[formField] = error.message
          }
        })
        setFieldErrors(fieldErrorMap)
        return false
      }

      setValidationErrors([])
      setFieldErrors({})
      return true
    } catch (error) {
      console.error('Validation error:', error)
      return false
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Clear previous errors
    clearError()
    setValidationErrors([])
    setFieldErrors({})

    // Validate form data
    if (!validateFormData()) {
      return
    }

    // Submit form
    const result = await submit(
      () => {
        if (mode === 'create') {
          return patientAPI.create(formData)
        } else {
          // For edit mode, you would need the patient ID
          throw new Error('Edit mode not implemented in this example')
        }
      },
      `EnhancedPatientForm.${mode}`
    )

    if (result) {
      onSuccess?.(result)
    }
  }

  const handleCancel = () => {
    reset()
    onCancel?.()
  }

  const getFieldError = (field: string) => fieldErrors[field]

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {mode === 'create' ? 'Add New Patient' : 'Edit Patient'}
        </CardTitle>
        <CardDescription>
          {mode === 'create'
            ? 'Enter patient information to create a new record'
            : 'Update patient information'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormLoadingOverlay loading={loading}>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <ValidationError
                errors={validationErrors}
                onRetry={() => {
                  setValidationErrors([])
                  setFieldErrors({})
                }}
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

            {/* Form Error Display */}
            {error && (
              <ErrorDisplay
                error={error}
                onRetry={() => {
                  reset()
                  clearError()
                }}
                variant="inline"
              />
            )}

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Personal Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    className={getFieldError('first_name') ? 'border-destructive' : ''}
                    required
                  />
                  {getFieldError('first_name') && (
                    <p className="text-sm text-destructive">{getFieldError('first_name')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    className={getFieldError('last_name') ? 'border-destructive' : ''}
                    required
                  />
                  {getFieldError('last_name') && (
                    <p className="text-sm text-destructive">{getFieldError('last_name')}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth *</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                    className={getFieldError('date_of_birth') ? 'border-destructive' : ''}
                    required
                  />
                  {getFieldError('date_of_birth') && (
                    <p className="text-sm text-destructive">{getFieldError('date_of_birth')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => handleInputChange('gender', value)}
                  >
                    <SelectTrigger className={getFieldError('gender') ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {getFieldError('gender') && (
                    <p className="text-sm text-destructive">{getFieldError('gender')}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={getFieldError('phone') ? 'border-destructive' : ''}
                  placeholder="+1 (555) 123-4567"
                  required
                />
                {getFieldError('phone') && (
                  <p className="text-sm text-destructive">{getFieldError('phone')}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Textarea
                  id="location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className={getFieldError('location') ? 'border-destructive' : ''}
                  rows={3}
                  placeholder="Enter patient's address or location"
                />
                {getFieldError('location') && (
                  <p className="text-sm text-destructive">{getFieldError('location')}</p>
                )}
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Emergency Contact</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact">Emergency Contact Name *</Label>
                  <Input
                    id="emergency_contact"
                    value={formData.emergency_contact}
                    onChange={(e) => handleInputChange('emergency_contact', e.target.value)}
                    className={getFieldError('emergency_contact') ? 'border-destructive' : ''}
                    required
                  />
                  {getFieldError('emergency_contact') && (
                    <p className="text-sm text-destructive">{getFieldError('emergency_contact')}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergency_phone">Emergency Contact Phone *</Label>
                  <Input
                    id="emergency_phone"
                    type="tel"
                    value={formData.emergency_phone}
                    onChange={(e) => handleInputChange('emergency_phone', e.target.value)}
                    className={getFieldError('emergency_phone') ? 'border-destructive' : ''}
                    placeholder="+1 (555) 987-6543"
                    required
                  />
                  {getFieldError('emergency_phone') && (
                    <p className="text-sm text-destructive">{getFieldError('emergency_phone')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Medical Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Medical Information</h3>

              <div className="space-y-2">
                <Label htmlFor="blood_type">Blood Type</Label>
                <Select
                  value={formData.blood_type}
                  onValueChange={(value) => handleInputChange('blood_type', value)}
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
                <Label htmlFor="medical_history">Medical History</Label>
                <Textarea
                  id="medical_history"
                  value={formData.medical_history}
                  onChange={(e) => handleInputChange('medical_history', e.target.value)}
                  rows={4}
                  placeholder="Enter any relevant medical history, allergies, or conditions"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <LoadingButton
                type="submit"
                loading={loading}
                loadingText={mode === 'create' ? 'Creating...' : 'Updating...'}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                {mode === 'create' ? 'Create Patient' : 'Update Patient'}
              </LoadingButton>

              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </form>
        </FormLoadingOverlay>
      </CardContent>
    </Card>
  )
}

// Example of how to wrap the form with error boundary
export const EnhancedPatientFormWithErrorBoundary = withErrorBoundary(
  EnhancedPatientForm,
  { context: 'PatientForm' }
)
