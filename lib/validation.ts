// Form validation utilities and schemas

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// Generic validation functions
export const validators = {
  required: (value: any, fieldName: string): ValidationError | null => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return { field: fieldName, message: `${fieldName} is required` }
    }
    return null
  },

  email: (value: string, fieldName: string): ValidationError | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (value && !emailRegex.test(value)) {
      return { field: fieldName, message: 'Please enter a valid email address' }
    }
    return null
  },

  phone: (value: string, fieldName: string): ValidationError | null => {
    const phoneRegex = /^(\+254|0)[0-9]{9}$/
    if (value && !phoneRegex.test(value.replace(/\s/g, ''))) {
      return { field: fieldName, message: 'Please enter a valid Kenyan phone number' }
    }
    return null
  },

  minLength: (value: string, min: number, fieldName: string): ValidationError | null => {
    if (value && value.length < min) {
      return { field: fieldName, message: `${fieldName} must be at least ${min} characters long` }
    }
    return null
  },

  maxLength: (value: string, max: number, fieldName: string): ValidationError | null => {
    if (value && value.length > max) {
      return { field: fieldName, message: `${fieldName} must not exceed ${max} characters` }
    }
    return null
  },

  number: (value: any, fieldName: string): ValidationError | null => {
    if (value && (isNaN(Number(value)) || Number(value) < 0)) {
      return { field: fieldName, message: `${fieldName} must be a valid positive number` }
    }
    return null
  },

  date: (value: string, fieldName: string): ValidationError | null => {
    if (value) {
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return { field: fieldName, message: 'Please enter a valid date' }
      }
    }
    return null
  },

  futureDate: (value: string, fieldName: string): ValidationError | null => {
    if (value) {
      const date = new Date(value)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (date < today) {
        return { field: fieldName, message: `${fieldName} must be a future date` }
      }
    }
    return null
  },

  pastDate: (value: string, fieldName: string): ValidationError | null => {
    if (value) {
      const date = new Date(value)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      if (date > today) {
        return { field: fieldName, message: `${fieldName} must be a past date` }
      }
    }
    return null
  }
}

// Validation schemas for different forms
export const validationSchemas = {
  patient: {
    firstName: [validators.required, (v: string) => validators.minLength(v, 2, 'First name')],
    lastName: [validators.required, (v: string) => validators.minLength(v, 2, 'Last name')],
    dateOfBirth: [validators.required, validators.date, validators.pastDate],
    gender: [validators.required],
    phone: [validators.required, validators.phone],
    location: [(v: string) => validators.minLength(v, 5, 'Location')],
    emergencyContact: [validators.required, (v: string) => validators.minLength(v, 2, 'Emergency contact name')],
    emergencyPhone: [validators.required, validators.phone]
  },

  appointment: {
    patientId: [validators.required],
    date: [validators.required, validators.date, validators.futureDate],
    time: [validators.required],
    type: [validators.required],
    notes: [(v: string) => validators.maxLength(v, 500, 'Notes')]
  },

  medication: {
    name: [validators.required, (v: string) => validators.minLength(v, 2, 'Medication name')],
    genericName: [validators.required, (v: string) => validators.minLength(v, 2, 'Generic name')],
    category: [validators.required],
    manufacturer: [validators.required],
    batchNumber: [validators.required],
    expiryDate: [validators.required, validators.date, validators.futureDate],
    quantity: [validators.required, validators.number],
    unitPrice: [validators.required, validators.number],
    reorderLevel: [validators.required, validators.number]
  },

  invoice: {
    patientId: [validators.required],
    type: [validators.required],
    services: [(services: any[]) => {
      if (!services || services.length === 0) {
        return { field: 'services', message: 'At least one service is required' }
      }
      return null
    }]
  },

  prescription: {
    patientId: [validators.required],
    medications: [(medications: any[]) => {
      if (!medications || medications.length === 0) {
        return { field: 'medications', message: 'At least one medication is required' }
      }
      return null
    }],
    notes: [(v: string) => validators.maxLength(v, 1000, 'Notes')]
  }
}

// Generic validation function
export function validateForm(data: Record<string, any>, schema: Record<string, any[]>): ValidationResult {
  const errors: ValidationError[] = []

  for (const [field, validators] of Object.entries(schema)) {
    const value = data[field]
    
    for (const validator of validators) {
      const error = validator(value, field)
      if (error) {
        errors.push(error)
        break // Stop at first error for this field
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Real-time field validation
export function validateField(value: any, fieldName: string, validators: any[]): ValidationError | null {
  for (const validator of validators) {
    const error = validator(value, fieldName)
    if (error) {
      return error
    }
  }
  return null
}
