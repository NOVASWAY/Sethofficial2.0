// Enhanced validation utilities for patient import

export interface ValidationIssue {
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
  suggestion?: string
}

export interface ValidationSummary {
  totalRecords: number
  validRecords: number
  recordsWithErrors: number
  recordsWithWarnings: number
  issues: ValidationIssue[]
  qualityScore: number
  completenessScore: number
}

// Phone number patterns for different countries
const PHONE_PATTERNS: Record<string, RegExp> = {
  kenya: /^(\+?254|0)?[17]\d{8}$/,
  uganda: /^(\+?256|0)?[0-9]{9}$/,
  tanzania: /^(\+?255|0)?[0-9]{9}$/,
  rwanda: /^(\+?250|0)?[0-9]{9}$/,
  ethiopia: /^(\+?251|0)?[0-9]{9}$/,
  generic: /^(\+?[1-9]\d{1,3})?[0-9]{7,15}$/,
}

// Date format patterns
const DATE_PATTERNS = [
  { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD', name: 'ISO' },
  { pattern: /^\d{2}\/\d{2}\/\d{4}$/, format: 'DD/MM/YYYY', name: 'DD/MM/YYYY' },
  { pattern: /^\d{2}-\d{2}-\d{4}$/, format: 'DD-MM-YYYY', name: 'DD-MM-YYYY' },
  { pattern: /^\d{4}\/\d{2}\/\d{2}$/, format: 'YYYY/MM/DD', name: 'YYYY/MM/DD' },
  { pattern: /^\d{1,2}\/\d{1,2}\/\d{4}$/, format: 'M/D/YYYY', name: 'M/D/YYYY' },
]

/**
 * Validate phone number for multiple countries
 */
export function validatePhoneNumber(phone: string, country: string = 'kenya'): ValidationIssue | null {
  if (!phone || phone.trim() === '') {
    return {
      field: 'phone',
      message: 'Phone number is missing',
      severity: 'warning',
      suggestion: 'Add phone number for better contact',
    }
  }

  const normalized = phone.replace(/\s+/g, '').replace(/-/g, '')
  const pattern = PHONE_PATTERNS[country.toLowerCase()] || PHONE_PATTERNS.generic

  if (!pattern.test(normalized)) {
    return {
      field: 'phone',
      message: `Phone number format may be invalid for ${country}`,
      severity: 'warning',
      suggestion: `Expected format: ${country === 'kenya' ? '+254XXXXXXXXX or 0XXXXXXXXX' : 'country code + number'}`,
    }
  }

  return null
}

/**
 * Detect and convert date format
 */
export function detectAndConvertDate(dateString: string): { 
  isValid: boolean
  convertedDate?: string
  originalFormat?: string
  issue?: ValidationIssue
} {
  if (!dateString || dateString.trim() === '') {
    return {
      isValid: false,
      issue: {
        field: 'date',
        message: 'Date is missing',
        severity: 'warning',
      },
    }
  }

  // Try to parse as-is first
  const date = new Date(dateString)
  if (!isNaN(date.getTime())) {
    return {
      isValid: true,
      convertedDate: date.toISOString().split('T')[0],
      originalFormat: 'auto-detected',
    }
  }

  // Try to detect format
  for (const { pattern, format, name } of DATE_PATTERNS) {
    if (pattern.test(dateString)) {
      try {
        let converted: string
        if (format === 'DD/MM/YYYY' || format === 'DD-MM-YYYY') {
          const parts = dateString.split(/[\/\-]/)
          converted = `${parts[2]}-${parts[1]}-${parts[0]}`
        } else if (format === 'M/D/YYYY') {
          const parts = dateString.split('/')
          converted = `${parts[2]}-${String(parts[0]).padStart(2, '0')}-${String(parts[1]).padStart(2, '0')}`
        } else {
          converted = dateString.replace(/[\/\-]/g, '-')
        }

        const testDate = new Date(converted)
        if (!isNaN(testDate.getTime())) {
          return {
            isValid: true,
            convertedDate: converted,
            originalFormat: name,
          }
        }
      } catch {
        continue
      }
    }
  }

  return {
    isValid: false,
    issue: {
      field: 'date',
      message: 'Date format could not be detected',
      severity: 'error',
      suggestion: 'Use format: YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY',
    },
  }
}

/**
 * Validate email address
 */
export function validateEmail(email: string): ValidationIssue | null {
  if (!email || email.trim() === '') {
    return null // Email is optional
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return {
      field: 'email',
      message: 'Email format is invalid',
      severity: 'warning',
      suggestion: 'Use format: user@example.com',
    }
  }

  // Check for common typos
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
    return {
      field: 'email',
      message: 'Email may contain errors',
      severity: 'warning',
      suggestion: 'Check for extra dots or spaces',
    }
  }

  return null
}

/**
 * Standardize address/location
 */
export function standardizeAddress(address: string): {
  standardized: string
  issues: ValidationIssue[]
} {
  const issues: ValidationIssue[] = []

  if (!address || address.trim() === '') {
    return {
      standardized: '',
      issues: [{
        field: 'address',
        message: 'Address is missing',
        severity: 'warning',
      }],
    }
  }

  let standardized = address.trim()

  // Remove extra whitespace
  standardized = standardized.replace(/\s+/g, ' ')

  // Capitalize first letter of each word (optional enhancement)
  // standardized = standardized.split(' ').map(word => 
  //   word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  // ).join(' ')

  // Check for common issues
  if (standardized.length < 3) {
    issues.push({
      field: 'address',
      message: 'Address seems too short',
      severity: 'warning',
      suggestion: 'Provide more detailed address',
    })
  }

  if (standardized.length > 200) {
    issues.push({
      field: 'address',
      message: 'Address is very long',
      severity: 'info',
      suggestion: 'Consider splitting into address lines',
    })
  }

  return {
    standardized,
    issues,
  }
}

/**
 * Validate age and convert to date of birth
 */
export function validateAge(age: string, referenceDate?: Date): {
  isValid: boolean
  dateOfBirth?: string
  issue?: ValidationIssue
} {
  if (!age || age.trim() === '') {
    return {
      isValid: false,
      issue: {
        field: 'age',
        message: 'Age is missing',
        severity: 'warning',
      },
    }
  }

  const ageNum = parseInt(age)
  if (isNaN(ageNum)) {
    return {
      isValid: false,
      issue: {
        field: 'age',
        message: 'Age must be a number',
        severity: 'error',
        suggestion: 'Enter age as a number (e.g., 45)',
      },
    }
  }

  if (ageNum < 0) {
    return {
      isValid: false,
      issue: {
        field: 'age',
        message: 'Age cannot be negative',
        severity: 'error',
      },
    }
  }

  if (ageNum > 150) {
    return {
      isValid: false,
      issue: {
        field: 'age',
        message: 'Age seems unusually high',
        severity: 'warning',
        suggestion: 'Please verify the age',
      },
    }
  }

  if (ageNum > 120) {
    return {
      isValid: true,
      dateOfBirth: calculateDOBFromAge(ageNum, referenceDate),
      issue: {
        field: 'age',
        message: 'Age is very high',
        severity: 'info',
        suggestion: 'Please verify the age',
      },
    }
  }

  return {
    isValid: true,
    dateOfBirth: calculateDOBFromAge(ageNum, referenceDate),
  }
}

function calculateDOBFromAge(age: number, referenceDate?: Date): string {
  const ref = referenceDate || new Date()
  const birthYear = ref.getFullYear() - age
  return `${birthYear}-01-01`
}

/**
 * Calculate data completeness score
 */
export function calculateCompleteness(record: Record<string, any>, requiredFields: string[], optionalFields: string[]): number {
  let filled = 0
  let total = requiredFields.length + optionalFields.length

  requiredFields.forEach(field => {
    const value = record[field]
    if (value !== null && value !== undefined && value !== '' && 
        (typeof value !== 'string' || value.trim() !== '')) {
      filled++
    }
  })

  optionalFields.forEach(field => {
    const value = record[field]
    if (value !== null && value !== undefined && value !== '' && 
        (typeof value !== 'string' || value.trim() !== '')) {
      filled++
    }
  })

  return total > 0 ? Math.round((filled / total) * 100) : 0
}

/**
 * Calculate quality score for a record
 */
export function calculateQualityScore(
  record: Record<string, any>,
  issues: ValidationIssue[]
): number {
  let score = 100

  // Deduct points for errors
  const errors = issues.filter(i => i.severity === 'error')
  score -= errors.length * 20

  // Deduct points for warnings
  const warnings = issues.filter(i => i.severity === 'warning')
  score -= warnings.length * 5

  // Deduct points for info issues
  const info = issues.filter(i => i.severity === 'info')
  score -= info.length * 2

  return Math.max(0, Math.min(100, score))
}

/**
 * Generate validation summary for import
 */
export function generateValidationSummary(
  records: Array<Record<string, any>>,
  issues: ValidationIssue[][]
): ValidationSummary {
  const totalRecords = records.length
  let validRecords = 0
  let recordsWithErrors = 0
  let recordsWithWarnings = 0

  const allIssues: ValidationIssue[] = []
  let totalQualityScore = 0
  let totalCompletenessScore = 0

  records.forEach((record, index) => {
    const recordIssues = issues[index] || []
    const hasErrors = recordIssues.some(i => i.severity === 'error')
    const hasWarnings = recordIssues.some(i => i.severity === 'warning')

    if (hasErrors) {
      recordsWithErrors++
    } else if (hasWarnings) {
      recordsWithWarnings++
    } else {
      validRecords++
    }

    allIssues.push(...recordIssues)

    const qualityScore = calculateQualityScore(record, recordIssues)
    totalQualityScore += qualityScore

    const completenessScore = calculateCompleteness(
      record,
      ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone'],
      ['email', 'location', 'emergency_contact', 'emergency_phone']
    )
    totalCompletenessScore += completenessScore
  })

  const averageQualityScore = totalRecords > 0 
    ? Math.round(totalQualityScore / totalRecords) 
    : 0

  const averageCompletenessScore = totalRecords > 0
    ? Math.round(totalCompletenessScore / totalRecords)
    : 0

  return {
    totalRecords,
    validRecords,
    recordsWithErrors,
    recordsWithWarnings,
    issues: allIssues,
    qualityScore: averageQualityScore,
    completenessScore: averageCompletenessScore,
  }
}

/**
 * Get validation recommendations
 */
export function getValidationRecommendations(summary: ValidationSummary): string[] {
  const recommendations: string[] = []

  if (summary.recordsWithErrors > 0) {
    recommendations.push(`Fix ${summary.recordsWithErrors} record(s) with errors before importing`)
  }

  if (summary.recordsWithWarnings > 0) {
    recommendations.push(`Review ${summary.recordsWithWarnings} record(s) with warnings`)
  }

  if (summary.completenessScore < 70) {
    recommendations.push('Data completeness is low. Consider adding missing information')
  }

  if (summary.qualityScore < 80) {
    recommendations.push('Data quality score is below optimal. Review validation issues')
  }

  const phoneIssues = summary.issues.filter(i => i.field === 'phone')
  if (phoneIssues.length > 0) {
    recommendations.push(`Standardize ${phoneIssues.length} phone number(s)`)
  }

  const dateIssues = summary.issues.filter(i => i.field === 'date')
  if (dateIssues.length > 0) {
    recommendations.push(`Fix ${dateIssues.length} date format issue(s)`)
  }

  if (recommendations.length === 0) {
    recommendations.push('Data quality is good. Ready to import!')
  }

  return recommendations
}

