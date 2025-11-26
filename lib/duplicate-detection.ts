// Duplicate detection utilities for patient import

export interface DuplicateMatch {
  patientIndex: number
  existingPatientId?: string
  similarityScore: number
  matchType: 'name' | 'op_number' | 'phone' | 'combined'
  matchedFields: string[]
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean
  duplicates: DuplicateMatch[]
  warnings: string[]
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns a value between 0 (identical) and max(length1, length2) (completely different)
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        )
      }
    }
  }

  return matrix[len1][len2]
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 */
export function similarityScore(str1: string, str2: string): number {
  if (!str1 || !str2) return 0
  if (str1.toLowerCase() === str2.toLowerCase()) return 1

  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase())
  return 1 - (distance / maxLen)
}

/**
 * Normalize phone number for comparison
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '')
  // Remove leading country code (254) if present
  if (normalized.startsWith('254')) {
    normalized = normalized.substring(3)
  }
  // Remove leading 0
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1)
  }
  return normalized
}

/**
 * Normalize OP number for comparison
 */
export function normalizeOPNumber(opNumber: string): string {
  if (!opNumber) return ''
  // Remove slashes and spaces, convert to lowercase
  return opNumber.replace(/[\/\s]/g, '').toLowerCase()
}

/**
 * Normalize name for comparison (remove extra spaces, lowercase)
 */
export function normalizeName(name: string): string {
  if (!name) return ''
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Check if two names are similar (fuzzy match)
 */
export function isNameSimilar(name1: string, name2: string, threshold: number = 0.85): boolean {
  const normalized1 = normalizeName(name1)
  const normalized2 = normalizeName(name2)
  
  // Exact match
  if (normalized1 === normalized2) return true
  
  // Check similarity score
  const score = similarityScore(normalized1, normalized2)
  if (score >= threshold) return true
  
  // Check if one name contains the other (for partial matches)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    // Only consider it similar if the shorter name is at least 4 characters
    const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2
    if (shorter.length >= 4) {
      return true
    }
  }
  
  return false
}

/**
 * Check if two phone numbers match
 */
export function isPhoneMatch(phone1: string, phone2: string): boolean {
  if (!phone1 || !phone2) return false
  const normalized1 = normalizePhone(phone1)
  const normalized2 = normalizePhone(phone2)
  
  if (!normalized1 || !normalized2) return false
  
  // Exact match after normalization
  return normalized1 === normalized2
}

/**
 * Check if two OP numbers match
 */
export function isOPNumberMatch(op1: string, op2: string): boolean {
  if (!op1 || !op2) return false
  const normalized1 = normalizeOPNumber(op1)
  const normalized2 = normalizeOPNumber(op2)
  
  if (!normalized1 || !normalized2) return false
  
  // Exact match after normalization
  return normalized1 === normalized2
}

/**
 * Check for duplicates within the import batch
 */
export function checkBatchDuplicates(
  patients: Array<{
    name: string
    opNumber: string
    phoneNumber: string
  }>,
  options: {
    nameThreshold?: number
    checkName?: boolean
    checkOP?: boolean
    checkPhone?: boolean
  } = {}
): DuplicateCheckResult {
  const {
    nameThreshold = 0.85,
    checkName = true,
    checkOP = true,
    checkPhone = true,
  } = options

  const duplicates: DuplicateMatch[] = []
  const warnings: string[] = []

  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i]
    const matches: DuplicateMatch[] = []

    for (let j = i + 1; j < patients.length; j++) {
      const other = patients[j]
      const matchedFields: string[] = []
      let matchType: 'name' | 'op_number' | 'phone' | 'combined' = 'combined'
      let maxScore = 0

      // Check name similarity
      if (checkName && patient.name && other.name) {
        const nameScore = similarityScore(patient.name, other.name)
        if (isNameSimilar(patient.name, other.name, nameThreshold)) {
          matchedFields.push('name')
          matchType = 'name'
          maxScore = Math.max(maxScore, nameScore)
        }
      }

      // Check OP number match
      if (checkOP && patient.opNumber && other.opNumber) {
        if (isOPNumberMatch(patient.opNumber, other.opNumber)) {
          matchedFields.push('op_number')
          if (matchType === 'name') {
            matchType = 'combined'
          } else {
            matchType = 'op_number'
          }
          maxScore = Math.max(maxScore, 1.0)
        }
      }

      // Check phone match
      if (checkPhone && patient.phoneNumber && other.phoneNumber) {
        if (isPhoneMatch(patient.phoneNumber, other.phoneNumber)) {
          matchedFields.push('phone')
          if (matchType === 'name' || matchType === 'op_number') {
            matchType = 'combined'
          } else {
            matchType = 'phone'
          }
          maxScore = Math.max(maxScore, 1.0)
        }
      }

      // If we found matches, add to duplicates
      if (matchedFields.length > 0) {
        matches.push({
          patientIndex: j,
          similarityScore: maxScore,
          matchType,
          matchedFields,
        })
      }
    }

    if (matches.length > 0) {
      duplicates.push({
        patientIndex: i,
        similarityScore: matches[0].similarityScore,
        matchType: matches[0].matchType,
        matchedFields: matches[0].matchedFields,
      })

      // Add warnings for each match
      matches.forEach(match => {
        const matchedPatient = patients[match.patientIndex]
        const fields = match.matchedFields.join(', ')
        warnings.push(
          `Row ${i + 1} ("${patient.name}") may be duplicate of Row ${match.patientIndex + 1} ("${matchedPatient.name}") - matched on: ${fields}`
        )
      })
    }
  }

  return {
    hasDuplicates: duplicates.length > 0,
    duplicates,
    warnings,
  }
}

/**
 * Format duplicate warning message
 */
export function formatDuplicateWarning(match: DuplicateMatch, patientName: string, matchedPatientName: string): string {
  const fields = match.matchedFields.join(', ')
  const score = Math.round(match.similarityScore * 100)
  return `Possible duplicate: "${patientName}" matches "${matchedPatientName}" on ${fields} (${score}% similarity)`
}

