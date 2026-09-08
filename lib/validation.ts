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

// Zod schemas for API input validation
import { z } from "zod"

export const patientSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  bloodType: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  medicalHistory: z.string().optional(),
  insuranceType: z.string().optional(),
  insuranceNumber: z.string().optional(),
  age: z.number().optional(),
})

export const appointmentSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  doctorId: z.string().uuid("Invalid doctor ID"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  duration: z.number().optional(),
  notes: z.string().max(500).optional(),
})

export const consultationSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  doctorId: z.string().uuid("Invalid doctor ID"),
  appointmentId: z.string().uuid().optional(),
  visitDate: z.string().min(1, "Visit date is required"),
  visitTime: z.string().optional(),
  chiefComplaint: z.string().min(1, "Chief complaint is required"),
  vitalSigns: z.record(z.unknown()).optional(),
  physicalExamination: z.string().optional(),
  diagnosis: z.string().optional(),
  icd11Codes: z.array(z.string()).optional(),
  treatmentPlan: z.string().optional(),
  notes: z.string().optional(),
  followUpDate: z.string().optional(),
})

export const invoiceSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  consultationId: z.string().uuid().optional(),
  date: z.string().optional(),
  subtotal: z.number().optional(),
  taxAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  paymentStatus: z.enum(["pending", "partial", "paid", "overpaid"]).optional(),
  paymentMethod: z.string().optional(),
  items: z.array(z.object({
    itemType: z.string(),
    itemId: z.string().optional(),
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    totalPrice: z.number(),
    shaCovered: z.boolean().optional(),
    shaAmount: z.number().optional(),
    patientAmount: z.number().optional(),
  })).optional(),
})

export const prescriptionSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  doctorId: z.string().uuid().optional(),
  consultationId: z.string().uuid().optional(),
  clinicianId: z.string().uuid().optional(),
  medicineId: z.string().uuid().optional(),
  medicationName: z.string().optional(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  durationDays: z.number().optional(),
  quantity: z.number().optional(),
  instructions: z.string().optional(),
  items: z.array(z.object({
    medicineId: z.string().uuid().optional(),
    medicationId: z.string().uuid().optional(),
    quantity: z.number(),
    dosage: z.string().optional(),
    frequency: z.string().optional(),
    durationDays: z.number().optional(),
    duration: z.number().optional(),
    instructions: z.string().optional(),
  })).optional(),
})

export const medicineSchema = z.object({
  name: z.string().min(1, "Medicine name is required"),
  genericName: z.string().optional(),
  category: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  manufacturer: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  currentStock: z.number().optional(),
  minimumStock: z.number().optional(),
  reorderLevel: z.number().optional(),
  unitPrice: z.number().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  sideEffects: z.string().optional(),
})

export const labOrderSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  consultationId: z.string().uuid().optional(),
  testType: z.string().min(1, "Test type is required"),
  testCode: z.string().optional(),
  testName: z.string().min(1, "Test name is required"),
  priority: z.enum(["routine", "urgent", "stat"]).optional(),
  clinicalIndication: z.string().optional(),
  sampleType: z.string().optional(),
  notes: z.string().optional(),
})

export const labResultSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  testType: z.string().min(1, "Test type is required"),
  testName: z.string().min(1, "Test name is required"),
  testValues: z.record(z.unknown()).optional(),
  referenceRanges: z.record(z.unknown()).optional(),
  abnormalFlags: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
})

export const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "receptionist", "nurse", "clinician", "pharmacist", "lab_technician", "doctor"]),
  name: z.string().min(1, "Name is required"),
  department: z.string().optional(),
  permissions: z.array(z.string()).optional(),
})

export const noteSchema = z.object({
  resourceType: z.string().min(1, "Resource type is required"),
  resourceId: z.string().min(1, "Resource ID is required"),
  content: z.string().min(1, "Content is required"),
  isPrivate: z.boolean().optional(),
})

export const notificationSchema = z.object({
  recipientId: z.string().uuid("Invalid recipient ID"),
  notificationType: z.enum(["in_app", "email", "sms"]).optional(),
  template: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  content: z.string().min(1, "Content is required"),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  actionUrl: z.string().optional(),
  actionLabel: z.string().optional(),
})

export const paymentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  paymentMethod: z.enum(["cash", "mpesa", "card", "bank_transfer", "insurance", "sha"]).optional(),
  reference: z.string().optional(),
})

export const dispenseSchema = z.object({
  items: z.array(z.object({
    medicineId: z.string().uuid("Invalid medicine ID"),
    quantity: z.number().positive("Quantity must be positive"),
  })).optional(),
})

export const patientUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  bloodType: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  medicalHistory: z.string().optional(),
  insuranceType: z.string().optional(),
  insuranceNumber: z.string().optional(),
  age: z.number().optional(),
})

export const appointmentUpdateSchema = z.object({
  date: z.string().optional(),
  time: z.string().optional(),
  duration: z.number().optional(),
  status: z.enum(["scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show"]).optional(),
  notes: z.string().max(500).optional(),
  doctorId: z.string().uuid().optional(),
})

export const stockMovementSchema = z.object({
  medicationId: z.string().uuid("Invalid medication ID"),
  movementType: z.enum(["received", "dispensed", "adjusted", "expired", "returned"]),
  quantity: z.number().positive("Quantity must be positive"),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
})

export const serviceSchema = z.object({
  name: z.string().min(1, "Service name is required"),
  category: z.string().min(1, "Category is required"),
  basePrice: z.number().positive("Price must be positive"),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const workflowSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  appointmentId: z.string().uuid().optional(),
  currentStep: z.string().min(1, "Current step is required"),
  notes: z.string().optional(),
})
