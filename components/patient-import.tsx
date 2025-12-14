'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, X, Users, BarChart3 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePatientEnhanced } from '@/contexts/patient-context-enhanced'
import {
  checkBatchDuplicates,
  isNameSimilar,
  isPhoneMatch,
  isOPNumberMatch,
  normalizeName,
  normalizePhone,
  normalizeOPNumber,
  type DuplicateMatch
} from '@/lib/duplicate-detection'
import { patientAPI } from '@/lib/api-client'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  validatePhoneNumber,
  validateEmail,
  validateAge,
  standardizeAddress,
  detectAndConvertDate,
  generateValidationSummary,
  getValidationRecommendations,
  type ValidationIssue
} from '@/lib/import-validation'
import { DataQualityDashboard } from './data-quality-dashboard'
import { DataMapping, type FieldMapping, type MappingTemplate } from './data-mapping'
import { DuplicateMerge } from './duplicate-merge'

interface ImportedPatient {
  name: string
  age: string
  location: string
  opNumber: string
  phoneNumber: string
  yearFromOP?: string
  parsedYear?: number
  errors?: string[]
  warnings?: string[]
  duplicates?: DuplicateMatch[]
  existingDuplicates?: Array<{
    id: string
    patient_number: string
    first_name: string
    last_name: string
    phone: string
    matchType: string
  }>
}

export function PatientImport() {
  const { toast } = useToast()
  const { importPatients, patients: existingPatients } = usePatientEnhanced()
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [importedData, setImportedData] = useState<ImportedPatient[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [checkingDuplicates, setCheckingDuplicates] = useState(false)
  const [duplicateStats, setDuplicateStats] = useState({ batch: 0, existing: 0 })
  const [useBatchProcessing, setUseBatchProcessing] = useState(false)
  const [importProgress, setImportProgress] = useState<{
    current: number
    total: number
    currentBatch: number
    totalBatches: number
    imported: number
    failed: number
  } | null>(null)
  const [showQualityDashboard, setShowQualityDashboard] = useState(false)
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[][]>([])
  const [showMapping, setShowMapping] = useState(false)
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [rawCsvText, setRawCsvText] = useState<string>('')
  const [showDuplicateMerge, setShowDuplicateMerge] = useState(false)
  const [duplicateGroups, setDuplicateGroups] = useState<Array<{
    patients: Array<{
      id: string
      patient_number: string
      first_name: string
      last_name: string
      date_of_birth: string
      gender: string
      phone: string
      location?: string
      email?: string
      emergency_contact?: string
      emergency_phone?: string
      blood_type?: string
      allergies?: string[]
      medical_history?: string
      created_at: string
      updated_at: string
    }>
    matchType: string
    matchedFields: string[]
    similarityScore?: number
  }>>([])

  const parseOPNumber = (opNumber: string): { number: string; year: number | null } => {
    // Parse OP numbers like "789/06" where /06 represents year 2006
    const match = opNumber.match(/^(\d+)\/(\d{2})$/)
    if (match) {
      const [, num, yearSuffix] = match
      const year = parseInt(yearSuffix)
      // Convert 2-digit year to 4-digit (00-30 = 2000-2030, 31-99 = 1931-1999)
      const fullYear = year <= 30 ? 2000 + year : 1900 + year
      return { number: num, year: fullYear }
    }
    return { number: opNumber, year: null }
  }

  const calculateDOBFromAge = (age: string, referenceYear?: number): string => {
    const ageNum = parseInt(age)
    if (isNaN(ageNum)) return ''

    const currentYear = referenceYear || new Date().getFullYear()
    const birthYear = currentYear - ageNum
    // Set a default birth date (January 1st of birth year)
    return `${birthYear}-01-01`
  }

  // Check for duplicates against existing patients in database
  const checkExistingDuplicates = async (importedPatients: ImportedPatient[]): Promise<void> => {
    setCheckingDuplicates(true)
    try {
      // Check each imported patient against existing patients
      for (let i = 0; i < importedPatients.length; i++) {
        const patient = importedPatients[i]
        const existingMatches: Array<{
          id: string
          patient_number: string
          first_name: string
          last_name: string
          phone: string
          matchType: string
        }> = []

        // Check against existing patients
        for (const existing of existingPatients) {
          const nameParts = patient.name.split(' ')
          const firstName = nameParts[0] || ''
          const lastName = nameParts.slice(1).join(' ') || 'Patient'

          let matchType = ''
          const matchedFields: string[] = []

          // Check name similarity
          const fullName = `${firstName} ${lastName}`
          const existingFullName = `${existing.first_name} ${existing.last_name}`
          if (isNameSimilar(fullName, existingFullName, 0.85)) {
            matchType = 'name'
            matchedFields.push('name')
          }

          // Check OP number match
          if (patient.opNumber && existing.patient_number) {
            const normalizedOP = normalizeOPNumber(patient.opNumber)
            const normalizedExisting = normalizeOPNumber(existing.patient_number)
            if (normalizedOP && normalizedExisting && normalizedOP === normalizedExisting) {
              if (!matchType) matchType = 'op_number'
              matchedFields.push('op_number')
            }
          }

          // Check phone match
          if (patient.phoneNumber && existing.phone) {
            if (isPhoneMatch(patient.phoneNumber, existing.phone)) {
              if (!matchType) matchType = 'phone'
              matchedFields.push('phone')
            }
          }

          // If we found matches, add to existing duplicates
          if (matchedFields.length > 0) {
            existingMatches.push({
              id: existing.id,
              patient_number: existing.patient_number,
              first_name: existing.first_name,
              last_name: existing.last_name,
              phone: existing.phone,
              matchType: matchType || 'combined',
            })
          }
        }

        if (existingMatches.length > 0) {
          importedPatients[i].existingDuplicates = existingMatches
          if (!importedPatients[i].warnings) {
            importedPatients[i].warnings = []
          }
          importedPatients[i].warnings!.push(
            `Possible duplicate of existing patient: ${existingMatches[0].first_name} ${existingMatches[0].last_name} (${existingMatches[0].patient_number}) - matched on: ${existingMatches.map(m => m.matchType).join(', ')}`
          )
        }
      }

      setImportedData([...importedPatients])
    } catch (error) {
      console.error('Error checking existing duplicates:', error)
      toast({
        title: 'Duplicate Check Warning',
        description: 'Could not check against existing patients. Please review manually.',
        variant: 'warning',
      })
    } finally {
      setCheckingDuplicates(false)
    }
  }

  const validatePatientData = (patient: ImportedPatient, allPatients: ImportedPatient[], index: number): { errors: string[]; warnings: string[]; validationIssues: ValidationIssue[] } => {
    const errors: string[] = []
    const warnings: string[] = []
    const validationIssues: ValidationIssue[] = []

    // Only name is truly required - everything else can be missing or updated later
    if (!patient.name || patient.name.trim().length < 2) {
      errors.push('Name is required and must be at least 2 characters')
      validationIssues.push({
        field: 'name',
        message: 'Name is required and must be at least 2 characters',
        severity: 'error',
      })
    }

    // Enhanced age validation
    if (patient.age && patient.age.trim()) {
      const ageValidation = validateAge(patient.age)
      if (!ageValidation.isValid && ageValidation.issue) {
        if (ageValidation.issue.severity === 'error') {
          errors.push(ageValidation.issue.message)
        } else {
          warnings.push(ageValidation.issue.message)
        }
        validationIssues.push(ageValidation.issue)
      }
    } else {
      warnings.push('Age is missing - can be updated later')
      validationIssues.push({
        field: 'age',
        message: 'Age is missing',
        severity: 'warning',
      })
    }

    // Enhanced location/address validation
    if (patient.location && patient.location.trim()) {
      const addressValidation = standardizeAddress(patient.location)
      addressValidation.issues.forEach(issue => {
        warnings.push(issue.message)
        validationIssues.push(issue)
      })
    } else {
      warnings.push('Location is missing - can be updated later')
      validationIssues.push({
        field: 'location',
        message: 'Location is missing',
        severity: 'warning',
      })
    }

    // Enhanced phone validation
    if (patient.phoneNumber && patient.phoneNumber.trim()) {
      const phoneIssue = validatePhoneNumber(patient.phoneNumber, 'kenya')
      if (phoneIssue) {
        warnings.push(phoneIssue.message)
        validationIssues.push(phoneIssue)
      }
    } else {
      warnings.push('Phone number is missing - can be updated later')
      validationIssues.push({
        field: 'phone',
        message: 'Phone number is missing',
        severity: 'warning',
      })
    }

    // OP number validation - allow missing and duplicates
    if (!patient.opNumber || !patient.opNumber.trim()) {
      warnings.push('OP number is missing - system will generate new one')
      validationIssues.push({
        field: 'op_number',
        message: 'OP number is missing',
        severity: 'warning',
      })
    } else {
      // Check for duplicate OP numbers in the same import batch
      const duplicates = allPatients.filter((p, i) =>
        i !== index &&
        p.opNumber &&
        p.opNumber.trim().toLowerCase() === patient.opNumber.trim().toLowerCase()
      )

      if (duplicates.length > 0) {
        warnings.push(`Shared OP number (${duplicates.length + 1} family members) - will differentiate with suffix`)
        validationIssues.push({
          field: 'op_number',
          message: `Shared OP number with ${duplicates.length} other record(s)`,
          severity: 'info',
        })
      }
    }

    return { errors, warnings, validationIssues }
  }

  // Proper CSV parser that handles quoted fields, commas in values, and trailing quotes
  const parseCSVLine = (line: string): string[] => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = i + 1 < line.length ? line[i + 1] : null

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted field
          current += '"'
          i += 2
          continue
        } else if (inQuotes && (nextChar === ',' || nextChar === null || nextChar === '\r' || nextChar === '\n')) {
          // End of quoted field
          inQuotes = false
          i++
          continue
        } else if (!inQuotes) {
          // Start of quoted field
          inQuotes = true
          i++
          continue
        }
      }

      if (char === ',' && !inQuotes) {
        // End of field
        values.push(current.trim().replace(/^["']|["']$/g, '')) // Remove surrounding quotes
        current = ''
        i++
        continue
      }

      current += char
      i++
    }

    // Add the last field
    values.push(current.trim().replace(/^["']|["']$/g, '')) // Remove surrounding quotes

    return values
  }

  const parseCSV = (text: string, mappings?: FieldMapping[]): ImportedPatient[] => {
    // Normalize line endings and split
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalizedText.split('\n').filter(line => line.trim())
    if (lines.length === 0) return []

    // Get headers using proper CSV parsing
    const headers = parseCSVLine(lines[0])
    const headersLower = headers.map(h => h.toLowerCase().trim())

    // Use custom mappings if provided, otherwise auto-detect
    let nameIdx = -1
    let ageIdx = -1
    let locationIdx = -1
    let opIdx = -1
    let phoneIdx = -1

    if (mappings && mappings.length > 0) {
      // Use custom mappings
      mappings.forEach(mapping => {
        const csvIndex = headers.findIndex(h => h === mapping.csvColumn)
        if (csvIndex >= 0) {
          switch (mapping.databaseField) {
            case 'full_name':
            case 'first_name':
            case 'last_name':
              if (nameIdx < 0) nameIdx = csvIndex
              break
            case 'age':
              ageIdx = csvIndex
              break
            case 'location':
              locationIdx = csvIndex
              break
            case 'patient_number':
            case 'op_number':
              opIdx = csvIndex
              break
            case 'phone':
              phoneIdx = csvIndex
              break
          }
        }
      })
    } else {
      // Auto-detect (fallback)
      nameIdx = headersLower.findIndex(h => h.includes('name'))
      ageIdx = headersLower.findIndex(h => h.includes('age'))
      locationIdx = headersLower.findIndex(h => h.includes('location') || h.includes('address'))
      opIdx = headersLower.findIndex(h => h.includes('op') || h.includes('client'))
      phoneIdx = headersLower.findIndex(h => h.includes('phone') || h.includes('number') || h.includes('mobile'))
    }

    const patients: ImportedPatient[] = []

    for (let i = 1; i < lines.length; i++) {
      // Use proper CSV parsing instead of simple split
      const values = parseCSVLine(lines[i])

      if (values.length < 1) continue // Skip empty lines

      // Ensure we have enough values (pad with empty strings if missing)
      while (values.length < headers.length) {
        values.push('')
      }

      // Clean up values: remove trailing quotes and trim
      const cleanedValues = values.map(v => {
        let cleaned = v.trim()

        // Remove surrounding quotes if present (handles both double and single quotes)
        while ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
          (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
          cleaned = cleaned.slice(1, -1).trim()
        }

        // Remove any trailing single quotes that might be left (handles cases like "value'")
        cleaned = cleaned.replace(/^["']+|["']+$/g, '').trim()

        // Handle escaped quotes inside the value
        cleaned = cleaned.replace(/""/g, '"').replace(/''/g, "'")

        return cleaned
      })

      const opNumber = opIdx >= 0 && opIdx < cleanedValues.length ? cleanedValues[opIdx] : ''
      const { number: parsedOP, year: parsedYear } = parseOPNumber(opNumber)

      // Handle full name splitting if mapped
      let name = ''
      if (mappings && mappings.length > 0) {
        const nameMapping = mappings.find(m =>
          m.databaseField === 'full_name' ||
          m.databaseField === 'first_name' ||
          m.databaseField === 'last_name'
        )
        if (nameMapping) {
          const nameIndex = headers.findIndex(h => h === nameMapping.csvColumn)
          if (nameIndex >= 0 && nameIndex < cleanedValues.length) {
            name = cleanedValues[nameIndex] || ''
          }
        }
      } else {
        name = nameIdx >= 0 && nameIdx < cleanedValues.length ? cleanedValues[nameIdx] : ''
      }

      const patient: ImportedPatient = {
        name: name,
        age: ageIdx >= 0 && ageIdx < cleanedValues.length ? cleanedValues[ageIdx] : '',
        location: locationIdx >= 0 && locationIdx < cleanedValues.length ? cleanedValues[locationIdx] : '',
        opNumber: opNumber,
        phoneNumber: phoneIdx >= 0 && phoneIdx < cleanedValues.length ? cleanedValues[phoneIdx] : '',
        yearFromOP: parsedYear ? `${parsedYear}` : undefined,
        parsedYear: parsedYear || undefined,
      }

      patients.push(patient)
    }

    // Validate all patients (needs full array to check for duplicates)
    const issues: ValidationIssue[][] = []
    patients.forEach((patient, index) => {
      const validation = validatePatientData(patient, patients, index)
      patient.errors = validation.errors
      patient.warnings = validation.warnings
      issues.push(validation.validationIssues)
    })
    setValidationIssues(issues)

    // Check for duplicates within the batch
    const batchDuplicateCheck = checkBatchDuplicates(patients, {
      nameThreshold: 0.85,
      checkName: true,
      checkOP: true,
      checkPhone: true,
    })

    // Add duplicate warnings to patients
    if (batchDuplicateCheck.hasDuplicates) {
      batchDuplicateCheck.duplicates.forEach(dup => {
        if (!patients[dup.patientIndex].warnings) {
          patients[dup.patientIndex].warnings = []
        }
        if (!patients[dup.patientIndex].duplicates) {
          patients[dup.patientIndex].duplicates = []
        }
        patients[dup.patientIndex].duplicates!.push(dup)

        const matchedPatient = patients[dup.patientIndex]
        const matchedFields = dup.matchedFields.join(', ')
        const score = Math.round(dup.similarityScore * 100)
        patients[dup.patientIndex].warnings!.push(
          `Possible duplicate in batch - matched on: ${matchedFields} (${score}% similarity)`
        )
      })
    }

    // Update duplicate stats
    setDuplicateStats({
      batch: batchDuplicateCheck.duplicates.length,
      existing: 0, // Will be updated after checking existing patients
    })

    return patients
  }

  const generateUniquePatientNumber = (opNumber: string, patients: ImportedPatient[], index: number): string => {
    if (!opNumber || !opNumber.trim()) {
      // Generate new patient number if no OP number
      const year = new Date().getFullYear()
      const randomNum = Math.floor(1000 + Math.random() * 9000)
      return `PAT-${year}-${randomNum}`
    }

    // Check if this OP number is shared
    const sameOPNumbers = patients.filter((p, i) =>
      i <= index &&
      p.opNumber &&
      p.opNumber.trim().toLowerCase() === opNumber.trim().toLowerCase()
    )

    if (sameOPNumbers.length === 1) {
      // First person with this OP number - use as is
      return opNumber.replace('/', '-')
    } else {
      // Multiple people with same OP number - add suffix
      const suffix = String.fromCharCode(64 + sameOPNumbers.length) // A, B, C, etc.
      return `${opNumber.replace('/', '-')}-${suffix}`
    }
  }

  const processPatientForImport = (patient: ImportedPatient, patients: ImportedPatient[], index: number) => {
    // Split name into first and last name
    const nameParts = (patient.name || 'Unknown').trim().split(' ')
    const firstName = nameParts[0] || 'Unknown'
    const lastName = nameParts.slice(1).join(' ') || 'Patient'

    // Calculate date of birth from age if provided
    let dateOfBirth = '1990-01-01' // Default
    if (patient.age && !isNaN(Number(patient.age))) {
      const birthYear = new Date().getFullYear() - Number(patient.age)
      dateOfBirth = `${birthYear}-01-01`
    }

    // Use placeholder phone if missing (backend requires non-empty phone)
    let phone = patient.phoneNumber?.trim() || ''
    if (!phone || phone === 'Not provided') {
      phone = '0000000000' // Placeholder that backend will accept
    }

    // Use "Not specified" if location is missing
    let location = patient.location?.trim()
    if (!location || location === '') {
      location = 'Not specified'
    }

    return {
      patient_number: generateUniquePatientNumber(patient.opNumber, patients, index),
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      gender: 'Unknown', // Default gender
      phone: phone,
      location: location,
      emergency_contact: '',
      emergency_phone: '',
      status: 'active' as const,
      // Note: status field removed as backend doesn't accept it in create_patient
    }
  }

  const parseExcel = async (file: File): Promise<ImportedPatient[]> => {
    // For Excel files, we'll provide instructions to convert to CSV
    // In a production environment, you'd use a library like xlsx
    toast({
      title: 'Excel File Detected',
      description: 'Please save your Excel file as CSV format and try again, or we can process it as text.',
      variant: 'info',
    })
    return []
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setIsProcessing(true)

    try {
      const text = await selectedFile.text()
      setRawCsvText(text)

      // Extract headers using proper CSV parsing
      const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      const lines = normalizedText.split('\n').filter(line => line.trim())
      if (lines.length > 0) {
        const headers = parseCSVLine(lines[0])
        setCsvHeaders(headers)

        // Show mapping interface if headers are detected
        if (headers.length > 0) {
          setShowMapping(true)
        } else {
          // No headers, proceed with auto-detection
          const patients = parseCSV(text)
          processImportedData(patients)
        }
      }
    } catch (error) {
      toast({
        title: 'Error Reading File',
        description: 'Failed to parse the file. Please check the format.',
        variant: 'error',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const processImportedData = async (patients: ImportedPatient[]) => {
    setImportedData(patients)
    setShowPreview(true)

    const validCount = patients.filter(p => !p.errors || p.errors.length === 0).length
    const errorCount = patients.filter(p => p.errors && p.errors.length > 0).length
    const duplicateCount = patients.filter(p => p.duplicates && p.duplicates.length > 0).length

    // Check against existing patients in database
    if (existingPatients.length > 0) {
      await checkExistingDuplicates(patients)
    }

    toast({
      title: 'File Parsed Successfully',
      description: `Found ${patients.length} records: ${validCount} valid, ${errorCount} with errors${duplicateCount > 0 ? `, ${duplicateCount} possible duplicates` : ''}`,
    })
  }

  const handleMappingComplete = (mappings: FieldMapping[]) => {
    setFieldMappings(mappings)
    setShowMapping(false)

    // Parse CSV with custom mappings
    const patients = parseCSV(rawCsvText, mappings)
    processImportedData(patients)
  }

  const handleImport = async () => {
    setIsProcessing(true)
    setImportProgress(null)

    try {
      const validPatients = importedData.filter(p => !p.errors || p.errors.length === 0)

      // Process patients with unique patient numbers and default values
      const processedPatients = validPatients.map((patient, index) =>
        processPatientForImport(patient, validPatients, index)
      )

      // Count shared OP numbers
      const sharedOPCount = validPatients.filter(p =>
        p.warnings?.some(w => w.includes('Shared OP number'))
      ).length

      // Use batch processing for large imports (>50 records) or if explicitly enabled
      const shouldUseBatch = useBatchProcessing || processedPatients.length > 50

      if (shouldUseBatch) {
        // Batch import with progress tracking
        const batchSize = 100
        const totalBatches = Math.ceil(processedPatients.length / batchSize)

        setImportProgress({
          current: 0,
          total: processedPatients.length,
          currentBatch: 0,
          totalBatches,
          imported: 0,
          failed: 0,
        })

        const result = await patientAPI.batchImport(processedPatients, batchSize)

        if (result) {
          setImportProgress({
            current: result.imported + result.failed,
            total: result.total_records,
            currentBatch: result.total_batches,
            totalBatches: result.total_batches,
            imported: result.imported,
            failed: result.failed,
          })

          // Reload patients to get updated list
          await importPatients(processedPatients.slice(0, result.imported))

          let description = `Successfully imported ${result.imported} of ${result.total_records} patient record${result.imported > 1 ? 's' : ''}`
          if (sharedOPCount > 0) {
            description += ` (including ${sharedOPCount} family member${sharedOPCount > 1 ? 's' : ''} with shared OP numbers)`
          }
          if (result.failed > 0) {
            description += `. ${result.failed} record${result.failed > 1 ? 's' : ''} failed to import.`
          }
          description += ' Patients are now saved to the database and searchable.'

          toast({
            title: 'Batch Import Completed',
            description,
          })
        }
      } else {
        // Standard import for smaller batches
        const imported = await importPatients(processedPatients)

        let description = `Successfully imported ${imported.length} patient record${imported.length > 1 ? 's' : ''}`
        if (sharedOPCount > 0) {
          description += ` (including ${sharedOPCount} family member${sharedOPCount > 1 ? 's' : ''} with shared OP numbers)`
        }
        description += '. Patients are now saved to the database and searchable.'

        toast({
          title: 'Import Successful',
          description,
        })
      }

      setIsImportOpen(false)
      setFile(null)
      setImportedData([])
      setShowPreview(false)
      setImportProgress(null)
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import patients. Please try again.',
        variant: 'error',
      })
      setImportProgress(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadTemplate = () => {
    const template = `Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
Mary Smith,32,Kiambu,456/10,0723456789
David Kamau,28,Nakuru,789/15,+254734567890
Sarah Doe,,Nairobi,123/06,
Peter Kamau,35,,,0745678901
Grace Njeri,67,Nyeri,,`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'patient_import_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <>
      <Button onClick={() => setIsImportOpen(true)} variant="outline">
        <Upload className="w-4 h-4 mr-2" />
        Import Patient Data
      </Button>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Patient Records</DialogTitle>
            <DialogDescription>
              Import existing patient data from Excel/CSV files for system migration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Data Mapping Dialog */}
            {showMapping && csvHeaders.length > 0 && (
              <Dialog open={showMapping} onOpenChange={setShowMapping}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Map CSV Columns</DialogTitle>
                    <DialogDescription>
                      Map each CSV column to a database field. Required fields must be mapped.
                    </DialogDescription>
                  </DialogHeader>
                  <DataMapping
                    csvHeaders={csvHeaders}
                    onMappingComplete={handleMappingComplete}
                    onCancel={() => {
                      setShowMapping(false)
                      setFile(null)
                      setRawCsvText('')
                    }}
                    initialMappings={fieldMappings}
                  />
                </DialogContent>
              </Dialog>
            )}

            {/* Instructions */}
            <Alert>
              <FileSpreadsheet className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Import Guidelines:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li><strong>Name</strong> - Required. Patient's full name (minimum 2 characters)</li>
                    <li><strong>Age</strong> - Optional. Missing ages will be marked as "Unknown"</li>
                    <li><strong>Location</strong> - Optional. Missing locations will be marked as "Not specified"</li>
                    <li><strong>OP Number</strong> - Optional. Shared OP numbers are allowed (for family members)</li>
                    <li><strong>Phone Number</strong> - Optional. Missing numbers will be marked as "Not provided"</li>
                  </ul>
                  <p className="text-sm mt-2">
                    <strong>✨ Smart Features:</strong>
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>OP numbers with year suffix (e.g., 789/06) are automatically parsed for year 2006</li>
                    <li>Family members can share the same OP number - system adds suffixes (A, B, C...)</li>
                    <li>Missing data is allowed - you can update patient records later</li>
                    <li>Only patient name is truly required for import</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            {/* Template Download */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Need a template?</p>
                <p className="text-sm text-muted-foreground">Download a sample CSV file to get started</p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            {/* File Upload */}
            {!showPreview && (
              <Card>
                <CardHeader>
                  <CardTitle>Select File</CardTitle>
                  <CardDescription>Upload a CSV file containing patient records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border-2 border-dashed rounded-lg p-8 text-center">
                      <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <Label htmlFor="file-upload" className="cursor-pointer">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Click to upload or drag and drop</p>
                          <p className="text-xs text-muted-foreground">CSV files only (MAX. 10MB)</p>
                        </div>
                      </Label>
                      <input
                        id="file-upload"
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </div>
                    {file && (
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4" />
                          <span className="text-sm font-medium">{file.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFile(null)
                            setImportedData([])
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Data Preview */}
            {showPreview && importedData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Import Preview</h3>
                    <p className="text-sm text-muted-foreground">
                      Review the data before importing ({importedData.length} records)
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowPreview(false)
                        setFile(null)
                        setImportedData([])
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={isProcessing || importedData.filter(p => !p.errors || p.errors.length === 0).length === 0}
                    >
                      {isProcessing ? 'Importing...' : `Import ${importedData.filter(p => !p.errors || p.errors.length === 0).length} Valid Records`}
                    </Button>
                  </div>
                </div>

                {/* Batch Processing Toggle */}
                {importedData.length > 50 && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-blue-900">Large Import Detected</p>
                          <p className="text-sm text-blue-700">
                            {importedData.length} records found. Enable batch processing for better performance and progress tracking.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="batch-toggle" className="text-sm">Batch Processing</Label>
                          <Switch
                            id="batch-toggle"
                            checked={useBatchProcessing}
                            onCheckedChange={setUseBatchProcessing}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Import Progress */}
                {importProgress && (
                  <Card className="border-primary">
                    <CardHeader>
                      <CardTitle>Import Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Processing batch {importProgress.currentBatch} of {importProgress.totalBatches}</span>
                          <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                        </div>
                        <Progress value={(importProgress.current / importProgress.total) * 100} className="h-2" />
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total Records</p>
                          <p className="font-semibold">{importProgress.total}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Imported</p>
                          <p className="font-semibold text-green-600">{importProgress.imported}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Failed</p>
                          <p className="font-semibold text-red-600">{importProgress.failed}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Data Quality Dashboard Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium">Data Quality Analysis</p>
                    <p className="text-sm text-muted-foreground">
                      View comprehensive data quality metrics and recommendations
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setShowQualityDashboard(!showQualityDashboard)}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    {showQualityDashboard ? 'Hide' : 'Show'} Quality Dashboard
                  </Button>
                </div>

                {/* Data Quality Dashboard */}
                {showQualityDashboard && (
                  <div className="border rounded-lg p-4 bg-muted/30">
                    <DataQualityDashboard
                      records={importedData.map(p => ({
                        first_name: p.name.split(' ')[0] || '',
                        last_name: p.name.split(' ').slice(1).join(' ') || '',
                        date_of_birth: p.age ? calculateDOBFromAge(p.age) : '',
                        gender: 'Unknown',
                        phone: p.phoneNumber || '',
                        location: p.location || '',
                        email: '',
                        emergency_contact: '',
                        emergency_phone: '',
                      }))}
                      issues={validationIssues}
                    />
                  </div>
                )}

                {/* Statistics */}
                <div className="grid grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-2xl font-bold text-green-600">
                            {importedData.filter(p => !p.errors || p.errors.length === 0).length}
                          </p>
                          <p className="text-sm text-muted-foreground">Valid Records</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <div>
                          <p className="text-2xl font-bold text-red-600">
                            {importedData.filter(p => p.errors && p.errors.length > 0).length}
                          </p>
                          <p className="text-sm text-muted-foreground">With Errors</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-orange-600" />
                        <div>
                          <p className="text-2xl font-bold text-orange-600">
                            {importedData.filter(p => (p.duplicates && p.duplicates.length > 0) || (p.existingDuplicates && p.existingDuplicates.length > 0)).length}
                          </p>
                          <p className="text-sm text-muted-foreground">Possible Duplicates</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        <div>
                          <p className="text-2xl font-bold text-yellow-600">
                            {importedData.filter(p => p.warnings && p.warnings.length > 0 && (!p.errors || p.errors.length === 0)).length}
                          </p>
                          <p className="text-sm text-muted-foreground">With Warnings</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Duplicate Warning Alert */}
                {importedData.some(p => (p.duplicates && p.duplicates.length > 0) || (p.existingDuplicates && p.existingDuplicates.length > 0)) && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <Users className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold mb-1">Duplicate Detection Active</p>
                          <p className="text-sm">
                            {importedData.filter(p => p.duplicates && p.duplicates.length > 0).length} record(s) have duplicates within this batch, and{' '}
                            {importedData.filter(p => p.existingDuplicates && p.existingDuplicates.length > 0).length} record(s) may match existing patients in the database.
                            Review these records carefully before importing.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Prepare duplicate groups for merge component
                            const groups: typeof duplicateGroups = []

                            // Group duplicates from batch
                            const processed = new Set<number>()
                            importedData.forEach((patient, index) => {
                              if (processed.has(index)) return

                              if (patient.duplicates && patient.duplicates.length > 0) {
                                const group = {
                                  patients: [
                                    {
                                      id: `import-${index}`,
                                      patient_number: generateUniquePatientNumber(patient.opNumber, importedData, index),
                                      first_name: patient.name.split(' ')[0] || '',
                                      last_name: patient.name.split(' ').slice(1).join(' ') || '',
                                      date_of_birth: patient.age ? calculateDOBFromAge(patient.age) : '1990-01-01',
                                      gender: 'Unknown',
                                      phone: patient.phoneNumber || '',
                                      location: patient.location,
                                      created_at: new Date().toISOString(),
                                      updated_at: new Date().toISOString(),
                                    },
                                  ],
                                  matchType: patient.duplicates[0].matchType,
                                  matchedFields: patient.duplicates[0].matchedFields,
                                  similarityScore: patient.duplicates[0].similarityScore,
                                }

                                patient.duplicates.forEach(dup => {
                                  const dupPatient = importedData[dup.patientIndex]
                                  group.patients.push({
                                    id: `import-${dup.patientIndex}`,
                                    patient_number: generateUniquePatientNumber(dupPatient.opNumber, importedData, dup.patientIndex),
                                    first_name: dupPatient.name.split(' ')[0] || '',
                                    last_name: dupPatient.name.split(' ').slice(1).join(' ') || '',
                                    date_of_birth: dupPatient.age ? calculateDOBFromAge(dupPatient.age) : '1990-01-01',
                                    gender: 'Unknown',
                                    phone: dupPatient.phoneNumber || '',
                                    location: dupPatient.location,
                                    created_at: new Date().toISOString(),
                                    updated_at: new Date().toISOString(),
                                  })
                                  processed.add(dup.patientIndex)
                                })

                                groups.push(group)
                                processed.add(index)
                              }
                            })

                            setDuplicateGroups(groups)
                            setShowDuplicateMerge(true)
                          }}
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Review Duplicates
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Duplicate Merge Dialog */}
                {showDuplicateMerge && (
                  <Dialog open={showDuplicateMerge} onOpenChange={setShowDuplicateMerge}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Merge Duplicates</DialogTitle>
                        <DialogDescription>
                          Review and merge duplicate records found in the import
                        </DialogDescription>
                      </DialogHeader>
                      <DuplicateMerge
                        duplicates={duplicateGroups}
                        onMergeComplete={() => {
                          setShowDuplicateMerge(false)
                          toast({
                            title: 'Duplicates Processed',
                            description: 'Duplicate records have been reviewed. You can continue with the import.',
                          })
                        }}
                        onCancel={() => setShowDuplicateMerge(false)}
                      />
                    </DialogContent>
                  </Dialog>
                )}

                {/* Data Table */}
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>OP Number</TableHead>
                        <TableHead>→ Patient No.</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Issues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedData.map((patient, index) => (
                        <TableRow key={index} className={patient.errors && patient.errors.length > 0 ? 'bg-red-50' : ''}>
                          <TableCell>
                            {patient.errors && patient.errors.length > 0 ? (
                              <Badge variant="destructive">Error</Badge>
                            ) : patient.warnings && patient.warnings.length > 0 ? (
                              <Badge className="bg-yellow-500">Warning</Badge>
                            ) : (
                              <Badge className="bg-green-500">Valid</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{patient.name || <span className="text-red-500">Missing</span>}</TableCell>
                          <TableCell>{patient.age || <span className="text-muted-foreground italic">Unknown</span>}</TableCell>
                          <TableCell>{patient.location || <span className="text-muted-foreground italic">Not specified</span>}</TableCell>
                          <TableCell className="font-mono text-sm">{patient.opNumber || <span className="text-muted-foreground italic">None</span>}</TableCell>
                          <TableCell className="font-mono text-sm text-blue-600">
                            {generateUniquePatientNumber(patient.opNumber, importedData, index)}
                          </TableCell>
                          <TableCell>{patient.phoneNumber || <span className="text-muted-foreground italic">Not provided</span>}</TableCell>
                          <TableCell>
                            {patient.errors && patient.errors.length > 0 && (
                              <ul className="text-xs text-red-600 space-y-1">
                                {patient.errors.map((err, i) => (
                                  <li key={i}>• {err}</li>
                                ))}
                              </ul>
                            )}
                            {patient.warnings && patient.warnings.length > 0 && (!patient.errors || patient.errors.length === 0) && (
                              <ul className="text-xs space-y-1">
                                {patient.warnings.map((warn, i) => {
                                  const isDuplicate = warn.includes('duplicate') || warn.includes('Duplicate')
                                  return (
                                    <li key={i} className={isDuplicate ? 'text-orange-600 font-medium' : 'text-yellow-600'}>
                                      • {warn}
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                            {patient.existingDuplicates && patient.existingDuplicates.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-orange-200">
                                <p className="text-xs font-semibold text-orange-700 mb-1">Existing Patient Matches:</p>
                                <ul className="text-xs text-orange-600 space-y-1">
                                  {patient.existingDuplicates.map((dup, i) => (
                                    <li key={i}>
                                      • {dup.first_name} {dup.last_name} ({dup.patient_number}) - {dup.matchType}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

