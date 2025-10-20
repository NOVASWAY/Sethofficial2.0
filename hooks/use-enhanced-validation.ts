import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { validationAPI, activityLogAPI } from '@/lib/api-client'
import { APIError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

interface ValidationResult {
  isValid: boolean
  errors: Array<{
    field: string
    message: string
    code?: string
  }>
  warnings?: Array<{
    field: string
    message: string
    code?: string
  }>
}

interface DuplicateCheckResult {
  hasDuplicates: boolean
  duplicates: Array<{
    id: string
    match_type: string
    match_fields: string[]
    match_score: number
    details: any
  }>
}

interface BusinessRuleValidationResult {
  isValid: boolean
  violations: Array<{
    rule: string
    message: string
    severity: 'error' | 'warning' | 'info'
  }>
}

interface UseEnhancedValidationOptions {
  enableActivityLogging?: boolean
  showToastOnError?: boolean
}

export function useEnhancedValidation(options: UseEnhancedValidationOptions = {}) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    enableActivityLogging = true,
    showToastOnError = true
  } = options

  // Log validation activity
  const logValidationActivity = useCallback(async (action: string, details: any = {}) => {
    if (!enableActivityLogging || !user?.id) return

    try {
      await activityLogAPI.log({
        action,
        module: 'validation',
        entity_type: 'validation',
        details: {
          user_id: user.id,
          role: user.role,
          department: user.department,
          ...details
        }
      })
    } catch (error) {
      console.warn('Failed to log validation activity:', error)
    }
  }, [enableActivityLogging, user])

  // Validate patient data
  const validatePatient = useCallback(async (patientData: any): Promise<ValidationResult> => {
    try {
      setValidating(true)
      setError(null)

      const result = await validationAPI.validatePatient(patientData)
      
      await logValidationActivity('validate_patient', {
        patient_data: { first_name: patientData.first_name, last_name: patientData.last_name },
        validation_result: result
      })

      return result
    } catch (error) {
      console.error('Failed to validate patient:', error)
      const errorMessage = error instanceof APIError ? error.message : 'Failed to validate patient data'
      setError(errorMessage)
      
      if (showToastOnError) {
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        })
      }

      return {
        isValid: false,
        errors: [{ field: 'general', message: errorMessage }]
      }
    } finally {
      setValidating(false)
    }
  }, [logValidationActivity, showToastOnError, toast])

  // Validate user data
  const validateUser = useCallback(async (userData: any): Promise<ValidationResult> => {
    try {
      setValidating(true)
      setError(null)

      const result = await validationAPI.validateUser(userData)
      
      await logValidationActivity('validate_user', {
        user_data: { username: userData.username, role: userData.role },
        validation_result: result
      })

      return result
    } catch (error) {
      console.error('Failed to validate user:', error)
      const errorMessage = error instanceof APIError ? error.message : 'Failed to validate user data'
      setError(errorMessage)
      
      if (showToastOnError) {
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        })
      }

      return {
        isValid: false,
        errors: [{ field: 'general', message: errorMessage }]
      }
    } finally {
      setValidating(false)
    }
  }, [logValidationActivity, showToastOnError, toast])

  // Check for duplicate patient
  const checkDuplicatePatient = useCallback(async (patientData: any): Promise<DuplicateCheckResult> => {
    try {
      setValidating(true)
      setError(null)

      const result = await validationAPI.checkDuplicatePatient(patientData)
      
      await logValidationActivity('check_duplicate_patient', {
        patient_data: { first_name: patientData.first_name, last_name: patientData.last_name },
        duplicate_result: result
      })

      return result
    } catch (error) {
      console.error('Failed to check duplicate patient:', error)
      const errorMessage = error instanceof APIError ? error.message : 'Failed to check for duplicate patient'
      setError(errorMessage)
      
      if (showToastOnError) {
        toast({
          title: "Duplicate Check Error",
          description: errorMessage,
          variant: "destructive",
        })
      }

      return {
        hasDuplicates: false,
        duplicates: []
      }
    } finally {
      setValidating(false)
    }
  }, [logValidationActivity, showToastOnError, toast])

  // Check for duplicate user
  const checkDuplicateUser = useCallback(async (userData: any): Promise<DuplicateCheckResult> => {
    try {
      setValidating(true)
      setError(null)

      const result = await validationAPI.checkDuplicateUser(userData)
      
      await logValidationActivity('check_duplicate_user', {
        user_data: { username: userData.username },
        duplicate_result: result
      })

      return result
    } catch (error) {
      console.error('Failed to check duplicate user:', error)
      const errorMessage = error instanceof APIError ? error.message : 'Failed to check for duplicate user'
      setError(errorMessage)
      
      if (showToastOnError) {
        toast({
          title: "Duplicate Check Error",
          description: errorMessage,
          variant: "destructive",
        })
      }

      return {
        hasDuplicates: false,
        duplicates: []
      }
    } finally {
      setValidating(false)
    }
  }, [logValidationActivity, showToastOnError, toast])

  // Validate business rules
  const validateBusinessRules = useCallback(async (ruleData: any): Promise<BusinessRuleValidationResult> => {
    try {
      setValidating(true)
      setError(null)

      const result = await validationAPI.validateBusinessRules(ruleData)
      
      await logValidationActivity('validate_business_rules', {
        rule_data: ruleData,
        validation_result: result
      })

      return result
    } catch (error) {
      console.error('Failed to validate business rules:', error)
      const errorMessage = error instanceof APIError ? error.message : 'Failed to validate business rules'
      setError(errorMessage)
      
      if (showToastOnError) {
        toast({
          title: "Business Rules Validation Error",
          description: errorMessage,
          variant: "destructive",
        })
      }

      return {
        isValid: false,
        violations: [{ rule: 'general', message: errorMessage, severity: 'error' }]
      }
    } finally {
      setValidating(false)
    }
  }, [logValidationActivity, showToastOnError, toast])

  // Comprehensive validation for patient creation
  const validatePatientCreation = useCallback(async (patientData: any) => {
    try {
      setValidating(true)
      setError(null)

      // Run all validations in parallel
      const [validationResult, duplicateResult] = await Promise.all([
        validatePatient(patientData),
        checkDuplicatePatient(patientData)
      ])

      // Combine results
      const combinedResult = {
        isValid: validationResult.isValid && !duplicateResult.hasDuplicates,
        validation: validationResult,
        duplicates: duplicateResult,
        errors: [
          ...validationResult.errors,
          ...(duplicateResult.hasDuplicates ? [{
            field: 'duplicate',
            message: `Found ${duplicateResult.duplicates.length} potential duplicate(s)`,
            code: 'DUPLICATE_FOUND'
          }] : [])
        ]
      }

      await logValidationActivity('validate_patient_creation', {
        patient_data: { first_name: patientData.first_name, last_name: patientData.last_name },
        combined_result: combinedResult
      })

      return combinedResult
    } catch (error) {
      console.error('Failed to validate patient creation:', error)
      const errorMessage = error instanceof APIError ? error.message : 'Failed to validate patient creation'
      setError(errorMessage)
      
      if (showToastOnError) {
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        })
      }

      return {
        isValid: false,
        validation: { isValid: false, errors: [] },
        duplicates: { hasDuplicates: false, duplicates: [] },
        errors: [{ field: 'general', message: errorMessage }]
      }
    } finally {
      setValidating(false)
    }
  }, [validatePatient, checkDuplicatePatient, logValidationActivity, showToastOnError, toast])

  // Comprehensive validation for user creation
  const validateUserCreation = useCallback(async (userData: any) => {
    try {
      setValidating(true)
      setError(null)

      // Run all validations in parallel
      const [validationResult, duplicateResult] = await Promise.all([
        validateUser(userData),
        checkDuplicateUser(userData)
      ])

      // Combine results
      const combinedResult = {
        isValid: validationResult.isValid && !duplicateResult.hasDuplicates,
        validation: validationResult,
        duplicates: duplicateResult,
        errors: [
          ...validationResult.errors,
          ...(duplicateResult.hasDuplicates ? [{
            field: 'duplicate',
            message: `Found ${duplicateResult.duplicates.length} potential duplicate(s)`,
            code: 'DUPLICATE_FOUND'
          }] : [])
        ]
      }

      await logValidationActivity('validate_user_creation', {
        user_data: { username: userData.username, role: userData.role },
        combined_result: combinedResult
      })

      return combinedResult
    } catch (error) {
      console.error('Failed to validate user creation:', error)
      const errorMessage = error instanceof APIError ? error.message : 'Failed to validate user creation'
      setError(errorMessage)
      
      if (showToastOnError) {
        toast({
          title: "Validation Error",
          description: errorMessage,
          variant: "destructive",
        })
      }

      return {
        isValid: false,
        validation: { isValid: false, errors: [] },
        duplicates: { hasDuplicates: false, duplicates: [] },
        errors: [{ field: 'general', message: errorMessage }]
      }
    } finally {
      setValidating(false)
    }
  }, [validateUser, checkDuplicateUser, logValidationActivity, showToastOnError, toast])

  return {
    // State
    validating,
    error,
    
    // Individual validation functions
    validatePatient,
    validateUser,
    checkDuplicatePatient,
    checkDuplicateUser,
    validateBusinessRules,
    
    // Comprehensive validation functions
    validatePatientCreation,
    validateUserCreation,
    
    // Utility functions
    clearError: () => setError(null),
  }
}
