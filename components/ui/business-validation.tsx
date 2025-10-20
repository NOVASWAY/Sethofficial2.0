"use client"

import * as React from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Package, 
  Pill, 
  DollarSign,
  Calendar,
  User,
  FileText
} from "lucide-react"

export interface ValidationRule {
  id: string
  type: 'inventory' | 'prescription' | 'billing' | 'appointment' | 'patient'
  severity: 'error' | 'warning' | 'info'
  message: string
  field?: string
  value?: any
  suggestion?: string
  action?: () => void
}

export interface BusinessValidationResult {
  isValid: boolean
  rules: ValidationRule[]
  summary: {
    total: number
    errors: number
    warnings: number
    info: number
  }
}

interface BusinessValidationProps {
  result: BusinessValidationResult
  onFix?: (ruleId: string) => void
  onDismiss?: (ruleId: string) => void
  className?: string
}

export function BusinessValidation({ 
  result, 
  onFix, 
  onDismiss, 
  className 
}: BusinessValidationProps) {
  const { toast } = useToast()

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-200 bg-red-50 text-red-900'
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-900'
      case 'info':
        return 'border-blue-200 bg-blue-50 text-blue-900'
      default:
        return 'border-gray-200 bg-gray-50 text-gray-900'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'inventory':
        return <Package className="h-4 w-4" />
      case 'prescription':
        return <Pill className="h-4 w-4" />
      case 'billing':
        return <DollarSign className="h-4 w-4" />
      case 'appointment':
        return <Calendar className="h-4 w-4" />
      case 'patient':
        return <User className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const handleFix = (rule: ValidationRule) => {
    if (rule.action) {
      rule.action()
    }
    if (onFix) {
      onFix(rule.id)
    }
    toast({
      title: "Validation Fix Applied",
      description: `Applied fix for: ${rule.message}`,
    })
  }

  const handleDismiss = (ruleId: string) => {
    if (onDismiss) {
      onDismiss(ruleId)
    }
    toast({
      title: "Validation Dismissed",
      description: "Validation rule has been dismissed.",
    })
  }

  if (!result || result.rules.length === 0) {
    return null
  }

  return (
    <div className={className}>
      {/* Summary Card */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Business Validation</span>
            {!result.isValid && (
              <Badge variant="destructive" className="ml-2">
                {result.summary.errors} Issues
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {result.isValid 
              ? "All business rules are satisfied" 
              : `${result.summary.errors} errors, ${result.summary.warnings} warnings found`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{result.summary.errors}</div>
              <div className="text-sm text-muted-foreground">Errors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{result.summary.warnings}</div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result.summary.info}</div>
              <div className="text-sm text-muted-foreground">Info</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Rules */}
      <div className="space-y-3">
        {result.rules.map((rule) => (
          <Alert key={rule.id} className={getSeverityColor(rule.severity)}>
            <div className="flex items-start space-x-3">
              {getSeverityIcon(rule.severity)}
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(rule.type)}
                  <span className="font-medium capitalize">{rule.type}</span>
                  <Badge variant="outline" className="text-xs">
                    {rule.severity}
                  </Badge>
                </div>
                <AlertDescription className="text-sm">
                  {rule.message}
                  {rule.field && (
                    <span className="block text-xs mt-1 text-muted-foreground">
                      Field: {rule.field}
                      {rule.value && ` (Value: ${rule.value})`}
                    </span>
                  )}
                  {rule.suggestion && (
                    <span className="block text-xs mt-1 font-medium">
                      Suggestion: {rule.suggestion}
                    </span>
                  )}
                </AlertDescription>
                <div className="flex space-x-2">
                  {rule.action && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleFix(rule)}
                      className="h-7 text-xs"
                    >
                      Fix
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDismiss(rule.id)}
                    className="h-7 text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </Alert>
        ))}
      </div>
    </div>
  )
}

// Business validation utilities
export class BusinessValidator {
  static validateInventory(medication: any): ValidationRule[] {
    const rules: ValidationRule[] = []

    // Check stock levels
    if (medication.quantity <= 0) {
      rules.push({
        id: 'inventory-empty',
        type: 'inventory',
        severity: 'error',
        message: `${medication.name} is out of stock`,
        field: 'quantity',
        value: medication.quantity,
        suggestion: 'Restock this medication immediately',
        action: () => {
          // Auto-restock action
          console.log('Auto-restocking medication:', medication.name)
        }
      })
    } else if (medication.quantity <= medication.reorder_level) {
      rules.push({
        id: 'inventory-low',
        type: 'inventory',
        severity: 'warning',
        message: `${medication.name} is running low (${medication.quantity} remaining)`,
        field: 'quantity',
        value: medication.quantity,
        suggestion: 'Consider reordering soon',
        action: () => {
          // Generate reorder request
          console.log('Generating reorder request for:', medication.name)
        }
      })
    }

    // Check expiry dates
    if (medication.expiry_date) {
      const expiryDate = new Date(medication.expiry_date)
      const today = new Date()
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      if (daysUntilExpiry <= 0) {
        rules.push({
          id: 'inventory-expired',
          type: 'inventory',
          severity: 'error',
          message: `${medication.name} has expired`,
          field: 'expiry_date',
          value: medication.expiry_date,
          suggestion: 'Remove from inventory immediately',
          action: () => {
            // Mark as expired
            console.log('Marking medication as expired:', medication.name)
          }
        })
      } else if (daysUntilExpiry <= 30) {
        rules.push({
          id: 'inventory-expiring',
          type: 'inventory',
          severity: 'warning',
          message: `${medication.name} expires in ${daysUntilExpiry} days`,
          field: 'expiry_date',
          value: medication.expiry_date,
          suggestion: 'Use soon or return to supplier',
        })
      }
    }

    return rules
  }

  static validatePrescription(prescription: any, patient: any): ValidationRule[] {
    const rules: ValidationRule[] = []

    // Check patient allergies
    if (patient.allergies && prescription.medication) {
      const allergies = patient.allergies.toLowerCase()
      const medicationName = prescription.medication.name.toLowerCase()
      
      if (allergies.includes(medicationName)) {
        rules.push({
          id: 'prescription-allergy',
          type: 'prescription',
          severity: 'error',
          message: `Patient is allergic to ${prescription.medication.name}`,
          field: 'medication',
          value: prescription.medication.name,
          suggestion: 'Choose an alternative medication',
        })
      }
    }

    // Check dosage
    if (prescription.dosage && prescription.medication) {
      const dosage = parseFloat(prescription.dosage)
      if (dosage <= 0) {
        rules.push({
          id: 'prescription-dosage',
          type: 'prescription',
          severity: 'error',
          message: 'Invalid dosage amount',
          field: 'dosage',
          value: prescription.dosage,
          suggestion: 'Enter a valid dosage amount',
        })
      }
    }

    // Check duration
    if (prescription.duration_days && prescription.duration_days > 90) {
      rules.push({
        id: 'prescription-duration',
        type: 'prescription',
        severity: 'warning',
        message: 'Prescription duration is longer than 90 days',
        field: 'duration_days',
        value: prescription.duration_days,
        suggestion: 'Consider shorter duration with follow-up',
      })
    }

    return rules
  }

  static validateBilling(invoice: any): ValidationRule[] {
    const rules: ValidationRule[] = []

    // Check totals
    if (invoice.subtotal && invoice.tax && invoice.total) {
      const expectedTotal = invoice.subtotal + invoice.tax
      const difference = Math.abs(expectedTotal - invoice.total)
      
      if (difference > 0.01) {
        rules.push({
          id: 'billing-total',
          type: 'billing',
          severity: 'error',
          message: 'Invoice total calculation is incorrect',
          field: 'total',
          value: invoice.total,
          suggestion: `Expected total: ${expectedTotal.toFixed(2)}`,
          action: () => {
            // Auto-correct total
            console.log('Auto-correcting invoice total')
          }
        })
      }
    }

    // Check tax calculation (16% VAT)
    if (invoice.subtotal && invoice.tax) {
      const expectedTax = invoice.subtotal * 0.16
      const difference = Math.abs(expectedTax - invoice.tax)
      
      if (difference > 0.01) {
        rules.push({
          id: 'billing-tax',
          type: 'billing',
          severity: 'error',
          message: 'Tax calculation is incorrect (should be 16% VAT)',
          field: 'tax',
          value: invoice.tax,
          suggestion: `Expected tax: ${expectedTax.toFixed(2)}`,
          action: () => {
            // Auto-correct tax
            console.log('Auto-correcting tax calculation')
          }
        })
      }
    }

    // Check for negative amounts
    if (invoice.subtotal < 0 || invoice.tax < 0 || invoice.total < 0) {
      rules.push({
        id: 'billing-negative',
        type: 'billing',
        severity: 'error',
        message: 'Invoice contains negative amounts',
        field: 'amounts',
        suggestion: 'All amounts must be positive',
      })
    }

    return rules
  }

  static validateAppointment(appointment: any): ValidationRule[] {
    const rules: ValidationRule[] = []

    // Check appointment date
    if (appointment.appointment_date) {
      const appointmentDate = new Date(appointment.appointment_date)
      const today = new Date()
      
      if (appointmentDate < today) {
        rules.push({
          id: 'appointment-past',
          type: 'appointment',
          severity: 'error',
          message: 'Appointment is scheduled in the past',
          field: 'appointment_date',
          value: appointment.appointment_date,
          suggestion: 'Schedule for a future date',
        })
      }
    }

    // Check business hours
    if (appointment.appointment_time) {
      const time = appointment.appointment_time.split(':')
      const hour = parseInt(time[0])
      
      if (hour < 8 || hour > 18) {
        rules.push({
          id: 'appointment-hours',
          type: 'appointment',
          severity: 'warning',
          message: 'Appointment is outside business hours (8 AM - 6 PM)',
          field: 'appointment_time',
          value: appointment.appointment_time,
          suggestion: 'Schedule during business hours',
        })
      }
    }

    return rules
  }

  static validatePatient(patient: any): ValidationRule[] {
    const rules: ValidationRule[] = []

    // Check age
    if (patient.date_of_birth) {
      const birthDate = new Date(patient.date_of_birth)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      
      if (age < 0 || age > 150) {
        rules.push({
          id: 'patient-age',
          type: 'patient',
          severity: 'error',
          message: 'Invalid patient age',
          field: 'date_of_birth',
          value: patient.date_of_birth,
          suggestion: 'Check date of birth',
        })
      }
    }

    // Check contact information
    if (!patient.phone) {
      rules.push({
        id: 'patient-contact',
        type: 'patient',
        severity: 'warning',
        message: 'Patient has no contact information',
        field: 'contact',
        suggestion: 'Add phone number',
      })
    }

    return rules
  }

  static validateAll(data: any, type: string): BusinessValidationResult {
    let rules: ValidationRule[] = []

    switch (type) {
      case 'inventory':
        rules = this.validateInventory(data)
        break
      case 'prescription':
        rules = this.validatePrescription(data, data.patient)
        break
      case 'billing':
        rules = this.validateBilling(data)
        break
      case 'appointment':
        rules = this.validateAppointment(data)
        break
      case 'patient':
        rules = this.validatePatient(data)
        break
      default:
        rules = []
    }

    const summary = {
      total: rules.length,
      errors: rules.filter(r => r.severity === 'error').length,
      warnings: rules.filter(r => r.severity === 'warning').length,
      info: rules.filter(r => r.severity === 'info').length,
    }

    return {
      isValid: summary.errors === 0,
      rules,
      summary,
    }
  }
}
