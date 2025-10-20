'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usePatientEnhanced } from '@/contexts/patient-context-enhanced'

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
}

export function PatientImport() {
  const { toast } = useToast()
  const { importPatients } = usePatientEnhanced()
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [importedData, setImportedData] = useState<ImportedPatient[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

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

  const validatePatientData = (patient: ImportedPatient, allPatients: ImportedPatient[], index: number): { errors: string[]; warnings: string[] } => {
    const errors: string[] = []
    const warnings: string[] = []

    // Only name is truly required - everything else can be missing or updated later
    if (!patient.name || patient.name.trim().length < 2) {
      errors.push('Name is required and must be at least 2 characters')
    }

    // Age validation - allow missing age
    if (patient.age && patient.age.trim()) {
      if (isNaN(parseInt(patient.age))) {
        warnings.push('Age is not a valid number')
      } else {
        const age = parseInt(patient.age)
        if (age < 0 || age > 150) {
          warnings.push('Age must be between 0 and 150')
        }
        if (age > 120) {
          warnings.push('Age seems unusually high')
        }
      }
    } else {
      warnings.push('Age is missing - can be updated later')
    }

    // Location validation - allow missing
    if (!patient.location || patient.location.trim().length < 2) {
      warnings.push('Location is missing - can be updated later')
    }

    // Phone validation - allow missing, validate if present
    if (patient.phoneNumber && patient.phoneNumber.trim()) {
      // Basic phone validation for Kenyan numbers
      const phoneRegex = /^(\+?254|0)?[17]\d{8}$/
      if (!phoneRegex.test(patient.phoneNumber.replace(/\s+/g, ''))) {
        warnings.push('Phone number format may be invalid')
      }
    } else {
      warnings.push('Phone number is missing - can be updated later')
    }

    // OP number validation - allow missing and duplicates
    if (!patient.opNumber || !patient.opNumber.trim()) {
      warnings.push('OP number is missing - system will generate new one')
    } else {
      // Check for duplicate OP numbers in the same import batch
      const duplicates = allPatients.filter((p, i) => 
        i !== index && 
        p.opNumber && 
        p.opNumber.trim().toLowerCase() === patient.opNumber.trim().toLowerCase()
      )
      
      if (duplicates.length > 0) {
        warnings.push(`Shared OP number (${duplicates.length + 1} family members) - will differentiate with suffix`)
      }
    }

    return { errors, warnings }
  }

  const parseCSV = (text: string): ImportedPatient[] => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length === 0) return []

    // Assume first line is header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    
    // Find column indices
    const nameIdx = headers.findIndex(h => h.includes('name'))
    const ageIdx = headers.findIndex(h => h.includes('age'))
    const locationIdx = headers.findIndex(h => h.includes('location') || h.includes('address'))
    const opIdx = headers.findIndex(h => h.includes('op') || h.includes('client'))
    const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('number') || h.includes('mobile'))

    const patients: ImportedPatient[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      
      if (values.length < 2) continue // Skip empty or invalid lines

      const opNumber = opIdx >= 0 ? values[opIdx] : ''
      const { number: parsedOP, year: parsedYear } = parseOPNumber(opNumber)

      const patient: ImportedPatient = {
        name: nameIdx >= 0 ? values[nameIdx] : '',
        age: ageIdx >= 0 ? values[ageIdx] : '',
        location: locationIdx >= 0 ? values[locationIdx] : '',
        opNumber: opNumber,
        phoneNumber: phoneIdx >= 0 ? values[phoneIdx] : '',
        yearFromOP: parsedYear ? `${parsedYear}` : undefined,
        parsedYear: parsedYear || undefined,
      }

      patients.push(patient)
    }

    // Validate all patients (needs full array to check for duplicates)
    patients.forEach((patient, index) => {
      const validation = validatePatientData(patient, patients, index)
      patient.errors = validation.errors
      patient.warnings = validation.warnings
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
    
    return {
      patient_number: generateUniquePatientNumber(patient.opNumber, patients, index),
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      gender: 'Unknown', // Not in import data
      phone: patient.phoneNumber || 'Not provided',
      location: patient.location || 'Not specified',
      emergency_contact: '',
      emergency_phone: '',
      status: 'active' as const,
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
      const patients = parseCSV(text)
      
      setImportedData(patients)
      setShowPreview(true)
      
      const validCount = patients.filter(p => !p.errors || p.errors.length === 0).length
      const errorCount = patients.filter(p => p.errors && p.errors.length > 0).length
      
      toast({
        title: 'File Parsed Successfully',
        description: `Found ${patients.length} records: ${validCount} valid, ${errorCount} with errors`,
      })
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

  const handleImport = async () => {
    setIsProcessing(true)

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
      
      // 🎯 ACTUAL IMPORT TO CONTEXT - DATA NOW SAVED!
      const imported = await importPatients(processedPatients)
      
      // TODO: Also send to backend API when available
      // await fetch('/api/patients/bulk-import', {
      //   method: 'POST',
      //   body: JSON.stringify({ patients: processedPatients })
      // })

      let description = `Successfully imported ${imported.length} patient record${imported.length > 1 ? 's' : ''}`
      if (sharedOPCount > 0) {
        description += ` (including ${sharedOPCount} family member${sharedOPCount > 1 ? 's' : ''} with shared OP numbers)`
      }
      description += '. Patients are now searchable and saved to local storage.'

      toast({
        title: 'Import Successful',
        description,
      })

      setIsImportOpen(false)
      setFile(null)
      setImportedData([])
      setShowPreview(false)
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import patients. Please try again.',
        variant: 'error',
      })
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

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-4">
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
                              <ul className="text-xs text-yellow-600 space-y-1">
                                {patient.warnings.map((warn, i) => (
                                  <li key={i}>• {warn}</li>
                                ))}
                              </ul>
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

