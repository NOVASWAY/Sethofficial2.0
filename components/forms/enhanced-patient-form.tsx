'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  User, Phone, MapPin, Calendar, Heart, AlertTriangle, 
  CheckCircle, XCircle, Info, Eye, EyeOff
} from 'lucide-react'
import { 
  validatePatientData, 
  sanitizeInput, 
  checkForDuplicates,
  validateBusinessRules,
  VALIDATION_PATTERNS 
} from '@/lib/data-validation-enhanced'

interface PatientFormData {
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  phone: string
  location: string
  emergencyContact: string
  emergencyPhone: string
  bloodType: string
  allergies: string
  medicalHistory: string
  insuranceType: string
  insuranceNumber: string
  guardianName?: string
  guardianPhone?: string
  guardianRelationship?: string
}

interface ValidationState {
  [key: string]: {
    isValid: boolean
    errors: string[]
    warnings: string[]
  }
}

interface EnhancedPatientFormProps {
  initialData?: Partial<PatientFormData>
  onSubmit: (data: PatientFormData) => void
  onCancel: () => void
  isLoading?: boolean
  existingPatients?: any[]
}

export function EnhancedPatientForm({
  initialData = {},
  onSubmit,
  onCancel,
  isLoading = false,
  existingPatients = []
}: EnhancedPatientFormProps) {
  const [formData, setFormData] = useState<PatientFormData>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    location: '',
    emergencyContact: '',
    emergencyPhone: '',
    bloodType: '',
    allergies: '',
    medicalHistory: '',
    insuranceType: '',
    insuranceNumber: '',
    guardianName: '',
    guardianPhone: '',
    guardianRelationship: '',
    ...initialData
  })

  const [validationState, setValidationState] = useState<ValidationState>({})
  const [showValidation, setShowValidation] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Real-time validation
  useEffect(() => {
    const validateForm = () => {
      const validation = validatePatientData(formData)
      const businessValidation = validateBusinessRules(formData, 'patient')
      
      // Check for duplicates
      const duplicates = checkForDuplicates(
        formData,
        existingPatients,
        ['phone', 'insuranceNumber']
      )

      setDuplicateCheck(duplicates)

      // Create field-specific validation state
      const fieldValidation: ValidationState = {}
      
      // Validate each field individually
      Object.keys(formData).forEach(field => {
        const fieldValue = formData[field as keyof PatientFormData]
        if (fieldValue) {
          // This would typically use individual field validation
          // For now, we'll use the overall validation result
          fieldValidation[field] = {
            isValid: !validation.errors.some(error => error.startsWith(field)),
            errors: validation.errors.filter(error => error.startsWith(field)),
            warnings: validation.warnings.filter(warning => warning.startsWith(field))
          }
        }
      })

      setValidationState(fieldValidation)
    }

    validateForm()
  }, [formData, existingPatients])

  // Handle input change with sanitization
  const handleInputChange = (field: keyof PatientFormData, value: string) => {
    const sanitizedValue = sanitizeInput(value)
    setFormData(prev => ({
      ...prev,
      [field]: sanitizedValue
    }))
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setIsSubmitting(true)
    setShowValidation(true)

    try {
      // Final validation
      const validation = validatePatientData(formData)
      const businessValidation = validateBusinessRules(formData, 'patient')
      
      if (!validation.isValid) {
        throw new Error('Please fix validation errors before submitting')
      }

      // Check for duplicates
      const duplicates = checkForDuplicates(
        formData,
        existingPatients,
        ['phone', 'insuranceNumber']
      )

      if (duplicates.length > 0) {
        throw new Error(`Duplicate data found: ${duplicates.join(', ')}`)
      }

      // Submit form
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get field validation state
  const getFieldValidation = (field: string) => {
    return validationState[field] || { isValid: true, errors: [], warnings: [] }
  }

  // Check if patient is under 18
  const isUnder18 = () => {
    if (!formData.dateOfBirth) return false
    const birthDate = new Date(formData.dateOfBirth)
    const age = new Date().getFullYear() - birthDate.getFullYear()
    return age < 18
  }

  // Format phone number
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    
    // Format as Kenyan phone number
    if (digits.startsWith('254')) {
      return `+${digits}`
    } else if (digits.startsWith('0')) {
      return `+254${digits.substring(1)}`
    } else if (digits.length === 9) {
      return `+254${digits}`
    }
    
    return value
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                placeholder="Enter first name"
                className={getFieldValidation('firstName').isValid ? '' : 'border-red-500'}
              />
              {showValidation && !getFieldValidation('firstName').isValid && (
                <div className="text-sm text-red-600 mt-1">
                  {getFieldValidation('firstName').errors[0]}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                placeholder="Enter last name"
                className={getFieldValidation('lastName').isValid ? '' : 'border-red-500'}
              />
              {showValidation && !getFieldValidation('lastName').isValid && (
                <div className="text-sm text-red-600 mt-1">
                  {getFieldValidation('lastName').errors[0]}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                className={getFieldValidation('dateOfBirth').isValid ? '' : 'border-red-500'}
              />
              {showValidation && !getFieldValidation('dateOfBirth').isValid && (
                <div className="text-sm text-red-600 mt-1">
                  {getFieldValidation('dateOfBirth').errors[0]}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="gender">Gender *</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) => handleInputChange('gender', value)}
              >
                <SelectTrigger className={getFieldValidation('gender').isValid ? '' : 'border-red-500'}>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {showValidation && !getFieldValidation('gender').isValid && (
                <div className="text-sm text-red-600 mt-1">
                  {getFieldValidation('gender').errors[0]}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', formatPhoneNumber(e.target.value))}
              placeholder="+254712345678 or 0712345678"
              className={getFieldValidation('phone').isValid ? '' : 'border-red-500'}
            />
            {showValidation && !getFieldValidation('phone').isValid && (
              <div className="text-sm text-red-600 mt-1">
                {getFieldValidation('phone').errors[0]}
              </div>
            )}
            {duplicateCheck.some(d => d.includes('phone')) && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  A patient with this phone number already exists
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label htmlFor="location">Location *</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="Enter location/address"
              className={getFieldValidation('location').isValid ? '' : 'border-red-500'}
            />
            {showValidation && !getFieldValidation('location').isValid && (
              <div className="text-sm text-red-600 mt-1">
                {getFieldValidation('location').errors[0]}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Emergency Contact
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergencyContact">Emergency Contact Name *</Label>
              <Input
                id="emergencyContact"
                value={formData.emergencyContact}
                onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                placeholder="Enter emergency contact name"
                className={getFieldValidation('emergencyContact').isValid ? '' : 'border-red-500'}
              />
              {showValidation && !getFieldValidation('emergencyContact').isValid && (
                <div className="text-sm text-red-600 mt-1">
                  {getFieldValidation('emergencyContact').errors[0]}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="emergencyPhone">Emergency Contact Phone *</Label>
              <Input
                id="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={(e) => handleInputChange('emergencyPhone', formatPhoneNumber(e.target.value))}
                placeholder="+254712345678 or 0712345678"
                className={getFieldValidation('emergencyPhone').isValid ? '' : 'border-red-500'}
              />
              {showValidation && !getFieldValidation('emergencyPhone').isValid && (
                <div className="text-sm text-red-600 mt-1">
                  {getFieldValidation('emergencyPhone').errors[0]}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guardian Information (for patients under 18) */}
      {isUnder18() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Guardian Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="guardianName">Guardian Name *</Label>
                <Input
                  id="guardianName"
                  value={formData.guardianName || ''}
                  onChange={(e) => handleInputChange('guardianName', e.target.value)}
                  placeholder="Enter guardian name"
                />
              </div>

              <div>
                <Label htmlFor="guardianPhone">Guardian Phone *</Label>
                <Input
                  id="guardianPhone"
                  value={formData.guardianPhone || ''}
                  onChange={(e) => handleInputChange('guardianPhone', formatPhoneNumber(e.target.value))}
                  placeholder="+254712345678 or 0712345678"
                />
              </div>

              <div>
                <Label htmlFor="guardianRelationship">Relationship *</Label>
                <Select
                  value={formData.guardianRelationship || ''}
                  onValueChange={(value) => handleInputChange('guardianRelationship', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                    <SelectItem value="sibling">Sibling</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Medical Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Medical Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="bloodType">Blood Type</Label>
            <Select
              value={formData.bloodType}
              onValueChange={(value) => handleInputChange('bloodType', value)}
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

          <div>
            <Label htmlFor="allergies">Allergies</Label>
            <Textarea
              id="allergies"
              value={formData.allergies}
              onChange={(e) => handleInputChange('allergies', e.target.value)}
              placeholder="List any known allergies"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="medicalHistory">Medical History</Label>
            <Textarea
              id="medicalHistory"
              value={formData.medicalHistory}
              onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
              placeholder="Enter relevant medical history"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Insurance Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Insurance Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="insuranceType">Insurance Type</Label>
              <Select
                value={formData.insuranceType}
                onValueChange={(value) => handleInputChange('insuranceType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select insurance type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sha">SHA (Social Health Authority)</SelectItem>
                  <SelectItem value="private">Private Insurance</SelectItem>
                  <SelectItem value="cash">Cash Payment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="insuranceNumber">Insurance Number</Label>
              <Input
                id="insuranceNumber"
                value={formData.insuranceNumber}
                onChange={(e) => handleInputChange('insuranceNumber', e.target.value)}
                placeholder="Enter insurance number"
                className={getFieldValidation('insuranceNumber').isValid ? '' : 'border-red-500'}
              />
              {showValidation && !getFieldValidation('insuranceNumber').isValid && (
                <div className="text-sm text-red-600 mt-1">
                  {getFieldValidation('insuranceNumber').errors[0]}
                </div>
              )}
              {duplicateCheck.some(d => d.includes('insuranceNumber')) && (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    A patient with this insurance number already exists
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Summary */}
      {showValidation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Validation Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(validationState).map(([field, validation]) => (
                <div key={field} className="flex items-center gap-2">
                  {validation.isValid ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm capitalize">{field.replace(/([A-Z])/g, ' $1')}</span>
                  {!validation.isValid && (
                    <Badge variant="destructive" className="text-xs">
                      {validation.errors.length} error(s)
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || isLoading}
          className="min-w-[120px]"
        >
          {isSubmitting ? 'Saving...' : 'Save Patient'}
        </Button>
      </div>
    </form>
  )
}
