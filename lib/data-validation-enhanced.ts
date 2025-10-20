/**
 * Enhanced Data Validation Library
 * Provides comprehensive validation for all data input across the clinic management system
 */

export interface ValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: any) => string | null
  message?: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface FieldValidation {
  [key: string]: ValidationRule
}

// Common validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^(\+254|0)[0-9]{9}$/,
  patientNumber: /^PAT-\d{4}-\d{4}$/,
  nationalId: /^[0-9]{8}$/,
  passport: /^[A-Z]{2}[0-9]{7}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  time: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
  price: /^\d+(\.\d{2})?$/,
  quantity: /^\d+$/,
  percentage: /^(100|[1-9]?\d)(\.\d+)?$/
}

// Patient validation rules
export const PATIENT_VALIDATION: FieldValidation = {
  firstName: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s]+$/,
    message: 'First name must be 2-50 characters and contain only letters'
  },
  lastName: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s]+$/,
    message: 'Last name must be 2-50 characters and contain only letters'
  },
  dateOfBirth: {
    required: true,
    pattern: VALIDATION_PATTERNS.date,
    custom: (value: string) => {
      const birthDate = new Date(value)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      
      if (age < 0 || age > 150) {
        return 'Invalid birth date'
      }
      if (age < 18 && !value.includes('guardian')) {
        return 'Guardian information required for patients under 18'
      }
      return null
    },
    message: 'Valid birth date is required'
  },
  gender: {
    required: true,
    custom: (value: string) => {
      const validGenders = ['male', 'female', 'other']
      return validGenders.includes(value.toLowerCase()) ? null : 'Invalid gender selection'
    },
    message: 'Gender is required'
  },
  phone: {
    required: true,
    pattern: VALIDATION_PATTERNS.phone,
    message: 'Valid Kenyan phone number is required (e.g., +254712345678 or 0712345678)'
  },
  location: {
    required: true,
    minLength: 5,
    maxLength: 200,
    message: 'Location must be 5-200 characters'
  },
  emergencyContact: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Emergency contact name is required'
  },
  emergencyPhone: {
    required: true,
    pattern: VALIDATION_PATTERNS.phone,
    message: 'Valid emergency contact phone number is required'
  },
  bloodType: {
    custom: (value: string) => {
      if (!value) return null // Optional field
      const validBloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
      return validBloodTypes.includes(value) ? null : 'Invalid blood type'
    },
    message: 'Valid blood type is required'
  },
  insuranceNumber: {
    custom: (value: string) => {
      if (!value) return null // Optional field
      if (value.length < 5 || value.length > 20) {
        return 'Insurance number must be 5-20 characters'
      }
      return null
    },
    message: 'Valid insurance number is required'
  }
}

// User validation rules
export const USER_VALIDATION: FieldValidation = {
  username: {
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_]+$/,
    message: 'Username must be 3-50 characters and contain only letters, numbers, and underscores'
  },
  password: {
    required: true,
    minLength: 8,
    custom: (value: string) => {
      const hasUpperCase = /[A-Z]/.test(value)
      const hasLowerCase = /[a-z]/.test(value)
      const hasNumbers = /\d/.test(value)
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value)
      
      if (!hasUpperCase) return 'Password must contain at least one uppercase letter'
      if (!hasLowerCase) return 'Password must contain at least one lowercase letter'
      if (!hasNumbers) return 'Password must contain at least one number'
      if (!hasSpecialChar) return 'Password must contain at least one special character'
      
      return null
    },
    message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
  },
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z\s]+$/,
    message: 'Name must be 2-100 characters and contain only letters'
  },
  role: {
    required: true,
    custom: (value: string) => {
      const validRoles = ['admin', 'receptionist', 'nurse', 'clinician', 'pharmacist']
      return validRoles.includes(value) ? null : 'Invalid role selection'
    },
    message: 'Valid role is required'
  },
  department: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Department is required'
  }
}

// Appointment validation rules
export const APPOINTMENT_VALIDATION: FieldValidation = {
  patientId: {
    required: true,
    custom: (value: string) => {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return uuidRegex.test(value) ? null : 'Invalid patient ID'
    },
    message: 'Valid patient is required'
  },
  doctorId: {
    required: true,
    custom: (value: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return uuidRegex.test(value) ? null : 'Invalid doctor ID'
    },
    message: 'Valid doctor is required'
  },
  date: {
    required: true,
    pattern: VALIDATION_PATTERNS.date,
    custom: (value: string) => {
      const appointmentDate = new Date(value)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (appointmentDate < today) {
        return 'Appointment date cannot be in the past'
      }
      
      // Check if date is more than 1 year in the future
      const oneYearFromNow = new Date()
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
      
      if (appointmentDate > oneYearFromNow) {
        return 'Appointment date cannot be more than 1 year in the future'
      }
      
      return null
    },
    message: 'Valid appointment date is required'
  },
  time: {
    required: true,
    pattern: VALIDATION_PATTERNS.time,
    custom: (value: string) => {
      const [hours, minutes] = value.split(':').map(Number)
      const appointmentTime = new Date()
      appointmentTime.setHours(hours, minutes, 0, 0)
      
      const businessStart = new Date()
      businessStart.setHours(8, 0, 0, 0)
      
      const businessEnd = new Date()
      businessEnd.setHours(17, 0, 0, 0)
      
      if (appointmentTime < businessStart || appointmentTime > businessEnd) {
        return 'Appointment time must be between 8:00 AM and 5:00 PM'
      }
      
      return null
    },
    message: 'Valid appointment time is required'
  },
  reason: {
    required: true,
    minLength: 10,
    maxLength: 500,
    message: 'Appointment reason must be 10-500 characters'
  }
}

// Medicine validation rules
export const MEDICINE_VALIDATION: FieldValidation = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Medicine name is required'
  },
  genericName: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Generic name is required'
  },
  dosage: {
    required: true,
    minLength: 2,
    maxLength: 50,
    message: 'Dosage information is required'
  },
  unitPrice: {
    required: true,
    pattern: VALIDATION_PATTERNS.price,
    custom: (value: string) => {
      const price = parseFloat(value)
      if (price < 0) return 'Price cannot be negative'
      if (price > 100000) return 'Price seems unusually high'
      return null
    },
    message: 'Valid price is required'
  },
  currentStock: {
    required: true,
    pattern: VALIDATION_PATTERNS.quantity,
    custom: (value: string) => {
      const stock = parseInt(value)
      if (stock < 0) return 'Stock cannot be negative'
      if (stock > 10000) return 'Stock quantity seems unusually high'
      return null
    },
    message: 'Valid stock quantity is required'
  },
  expiryDate: {
    required: true,
    pattern: VALIDATION_PATTERNS.date,
    custom: (value: string) => {
      const expiryDate = new Date(value)
      const today = new Date()
      
      if (expiryDate <= today) {
        return 'Medicine has expired'
      }
      
      // Warning for medicines expiring within 30 days
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
      
      if (expiryDate <= thirtyDaysFromNow) {
        return 'Medicine expires within 30 days'
      }
      
      return null
    },
    message: 'Valid expiry date is required'
  },
  batchNumber: {
    required: true,
    minLength: 3,
    maxLength: 20,
    message: 'Batch number is required'
  }
}

// Prescription validation rules
export const PRESCRIPTION_VALIDATION: FieldValidation = {
  medicineId: {
    required: true,
    custom: (value: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return uuidRegex.test(value) ? null : 'Invalid medicine ID'
    },
    message: 'Valid medicine is required'
  },
  quantity: {
    required: true,
    pattern: VALIDATION_PATTERNS.quantity,
    custom: (value: string) => {
      const quantity = parseInt(value)
      if (quantity <= 0) return 'Quantity must be greater than 0'
      if (quantity > 1000) return 'Quantity seems unusually high'
      return null
    },
    message: 'Valid quantity is required'
  },
  dosage: {
    required: true,
    minLength: 2,
    maxLength: 100,
    message: 'Dosage instructions are required'
  },
  frequency: {
    required: true,
    minLength: 2,
    maxLength: 50,
    message: 'Frequency is required'
  },
  duration: {
    required: true,
    minLength: 2,
    maxLength: 50,
    message: 'Duration is required'
  }
}

// Invoice validation rules
export const INVOICE_VALIDATION: FieldValidation = {
  patientId: {
    required: true,
    custom: (value: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return uuidRegex.test(value) ? null : 'Invalid patient ID'
    },
    message: 'Valid patient is required'
  },
  totalAmount: {
    required: true,
    pattern: VALIDATION_PATTERNS.price,
    custom: (value: string) => {
      const amount = parseFloat(value)
      if (amount <= 0) return 'Amount must be greater than 0'
      if (amount > 1000000) return 'Amount seems unusually high'
      return null
    },
    message: 'Valid amount is required'
  },
  paymentMethod: {
    required: true,
    custom: (value: string) => {
      const validMethods = ['cash', 'mpesa', 'sha', 'mixed']
      return validMethods.includes(value.toLowerCase()) ? null : 'Invalid payment method'
    },
    message: 'Valid payment method is required'
  },
  paymentStatus: {
    required: true,
    custom: (value: string) => {
      const validStatuses = ['pending', 'paid', 'partial', 'cancelled']
      return validStatuses.includes(value.toLowerCase()) ? null : 'Invalid payment status'
    },
    message: 'Valid payment status is required'
  }
}

/**
 * Validate a single field against its rules
 */
export function validateField(value: any, rules: ValidationRule): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required
  if (rules.required && (!value || value.toString().trim() === '')) {
    errors.push(rules.message || 'This field is required')
    return { isValid: false, errors, warnings }
  }

  // Skip other validations if value is empty and not required
  if (!value || value.toString().trim() === '') {
    return { isValid: true, errors, warnings }
  }

  const stringValue = value.toString()

  // Check min length
  if (rules.minLength && stringValue.length < rules.minLength) {
    errors.push(rules.message || `Minimum length is ${rules.minLength} characters`)
  }

  // Check max length
  if (rules.maxLength && stringValue.length > rules.maxLength) {
    errors.push(rules.message || `Maximum length is ${rules.maxLength} characters`)
  }

  // Check pattern
  if (rules.pattern && !rules.pattern.test(stringValue)) {
    errors.push(rules.message || 'Invalid format')
  }

  // Check custom validation
  if (rules.custom) {
    const customResult = rules.custom(value)
    if (customResult) {
      // Check if it's a warning (expiry within 30 days) or error
      if (customResult.includes('expires within') || customResult.includes('seems unusually')) {
        warnings.push(customResult)
      } else {
        errors.push(customResult)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Validate multiple fields against their rules
 */
export function validateFields(data: Record<string, any>, rules: FieldValidation): ValidationResult {
  const allErrors: string[] = []
  const allWarnings: string[] = []

  for (const [fieldName, fieldRules] of Object.entries(rules)) {
    const fieldValue = data[fieldName]
    const result = validateField(fieldValue, fieldRules)
    
    allErrors.push(...result.errors.map(error => `${fieldName}: ${error}`))
    allWarnings.push(...result.warnings.map(warning => `${fieldName}: ${warning}`))
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings
  }
}

/**
 * Validate patient data
 */
export function validatePatientData(data: Record<string, any>): ValidationResult {
  return validateFields(data, PATIENT_VALIDATION)
}

/**
 * Validate user data
 */
export function validateUserData(data: Record<string, any>): ValidationResult {
  return validateFields(data, USER_VALIDATION)
}

/**
 * Validate appointment data
 */
export function validateAppointmentData(data: Record<string, any>): ValidationResult {
  return validateFields(data, APPOINTMENT_VALIDATION)
}

/**
 * Validate medicine data
 */
export function validateMedicineData(data: Record<string, any>): ValidationResult {
  return validateFields(data, MEDICINE_VALIDATION)
}

/**
 * Validate prescription data
 */
export function validatePrescriptionData(data: Record<string, any>): ValidationResult {
  return validateFields(data, PRESCRIPTION_VALIDATION)
}

/**
 * Validate invoice data
 */
export function validateInvoiceData(data: Record<string, any>): ValidationResult {
  return validateFields(data, INVOICE_VALIDATION)
}

/**
 * Sanitize input data
 */
export function sanitizeInput(value: any): any {
  if (typeof value === 'string') {
    return value.trim().replace(/[<>]/g, '')
  }
  return value
}

/**
 * Check for duplicate data
 */
export function checkForDuplicates(
  data: Record<string, any>,
  existingData: Record<string, any>[],
  uniqueFields: string[]
): string[] {
  const duplicates: string[] = []

  for (const field of uniqueFields) {
    const value = data[field]
    if (value) {
      const existing = existingData.find(item => 
        item[field] && item[field].toString().toLowerCase() === value.toString().toLowerCase()
      )
      
      if (existing) {
        duplicates.push(`${field}: ${value} already exists`)
      }
    }
  }

  return duplicates
}

/**
 * Validate business rules
 */
export function validateBusinessRules(data: Record<string, any>, type: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  switch (type) {
    case 'patient':
      // Check if patient is under 18 and has guardian info
      if (data.dateOfBirth) {
        const birthDate = new Date(data.dateOfBirth)
        const age = new Date().getFullYear() - birthDate.getFullYear()
        
        if (age < 18 && !data.guardianName) {
          errors.push('Guardian information is required for patients under 18')
        }
      }
      break

    case 'appointment':
      // Check for appointment conflicts
      if (data.date && data.time && data.doctorId) {
        // This would typically check against existing appointments
        // For now, just validate the time is within business hours
        const [hours] = data.time.split(':').map(Number)
        if (hours < 8 || hours > 17) {
          errors.push('Appointments must be scheduled during business hours (8 AM - 5 PM)')
        }
      }
      break

    case 'prescription':
      // Check if medicine is in stock
      if (data.medicineId && data.quantity) {
        // This would typically check against current stock
        // For now, just validate quantity is reasonable
        const quantity = parseInt(data.quantity)
        if (quantity > 100) {
          warnings.push('Prescription quantity seems unusually high')
        }
      }
      break

    case 'invoice':
      // Check if amount is reasonable
      if (data.totalAmount) {
        const amount = parseFloat(data.totalAmount)
        if (amount > 100000) {
          warnings.push('Invoice amount seems unusually high')
        }
      }
      break
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}
