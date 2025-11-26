'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Upload, 
  Download,
  X,
  GripVertical,
  Info
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export interface FieldMapping {
  csvColumn: string
  databaseField: string
  required: boolean
  transformation?: string
}

export interface MappingTemplate {
  id?: string
  name: string
  description?: string
  mappings: FieldMapping[]
  created_at?: string
}

interface DataMappingProps {
  csvHeaders: string[]
  onMappingComplete: (mappings: FieldMapping[]) => void
  onCancel?: () => void
  initialMappings?: FieldMapping[]
  template?: MappingTemplate
}

const DATABASE_FIELDS = [
  { value: 'first_name', label: 'First Name', required: true, category: 'name' },
  { value: 'last_name', label: 'Last Name', required: true, category: 'name' },
  { value: 'full_name', label: 'Full Name (split)', required: false, category: 'name' },
  { value: 'age', label: 'Age (will be converted to Date of Birth)', required: false, category: 'demographics' },
  { value: 'date_of_birth', label: 'Date of Birth (optional - use Age instead)', required: false, category: 'demographics' },
  { value: 'gender', label: 'Gender', required: true, category: 'demographics' },
  { value: 'phone', label: 'Phone Number', required: true, category: 'contact' },
  { value: 'email', label: 'Email', required: false, category: 'contact' },
  { value: 'location', label: 'Location/Address', required: false, category: 'contact' },
  { value: 'patient_number', label: 'Patient Number (OP)', required: false, category: 'identification' },
  { value: 'op_number', label: 'OP Number', required: false, category: 'identification' },
  { value: 'emergency_contact', label: 'Emergency Contact', required: false, category: 'contact' },
  { value: 'emergency_phone', label: 'Emergency Phone', required: false, category: 'contact' },
  { value: 'blood_type', label: 'Blood Type', required: false, category: 'medical' },
  { value: 'allergies', label: 'Allergies', required: false, category: 'medical' },
  { value: 'medical_history', label: 'Medical History', required: false, category: 'medical' },
  { value: 'insurance_type', label: 'Insurance Type', required: false, category: 'insurance' },
  { value: 'insurance_number', label: 'Insurance Number', required: false, category: 'insurance' },
  { value: 'skip', label: 'Skip Column', required: false, category: 'other' },
]

const FIELD_CATEGORIES = [
  { value: 'name', label: 'Name Fields' },
  { value: 'demographics', label: 'Demographics' },
  { value: 'contact', label: 'Contact Information' },
  { value: 'identification', label: 'Identification' },
  { value: 'medical', label: 'Medical Information' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
]

export function DataMapping({ 
  csvHeaders, 
  onMappingComplete, 
  onCancel,
  initialMappings,
  template 
}: DataMappingProps) {
  const { toast } = useToast()
  const [mappings, setMappings] = useState<FieldMapping[]>(() => {
    if (initialMappings) return initialMappings
    if (template) return template.mappings
    
    // Auto-detect mappings
    return autoDetectMappings(csvHeaders)
  })
  const [savedTemplates, setSavedTemplates] = useState<MappingTemplate[]>([])
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')

  useEffect(() => {
    loadSavedTemplates()
  }, [])

  const loadSavedTemplates = () => {
    try {
      const stored = localStorage.getItem('import_mapping_templates')
      if (stored) {
        setSavedTemplates(JSON.parse(stored))
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }

  const saveTemplate = () => {
    if (!templateName.trim()) {
      toast({
        title: 'Template Name Required',
        description: 'Please enter a name for the template',
        variant: 'error',
      })
      return
    }

    const newTemplate: MappingTemplate = {
      id: Date.now().toString(),
      name: templateName,
      description: templateDescription,
      mappings: mappings,
      created_at: new Date().toISOString(),
    }

    const updated = [...savedTemplates, newTemplate]
    localStorage.setItem('import_mapping_templates', JSON.stringify(updated))
    setSavedTemplates(updated)
    setShowSaveTemplate(false)
    setTemplateName('')
    setTemplateDescription('')

    toast({
      title: 'Template Saved',
      description: `Template "${newTemplate.name}" has been saved`,
    })
  }

  const loadTemplate = (template: MappingTemplate) => {
    setMappings(template.mappings)
    toast({
      title: 'Template Loaded',
      description: `Template "${template.name}" has been loaded`,
    })
  }

  const deleteTemplate = (templateId: string) => {
    const updated = savedTemplates.filter(t => t.id !== templateId)
    localStorage.setItem('import_mapping_templates', JSON.stringify(updated))
    setSavedTemplates(updated)
    toast({
      title: 'Template Deleted',
      description: 'Template has been removed',
    })
  }

  const updateMapping = (csvColumn: string, databaseField: string) => {
    setMappings(prev => prev.map(m => 
      m.csvColumn === csvColumn 
        ? { ...m, databaseField }
        : m
    ))
  }

  const validateMappings = (): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    const requiredFields = ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone']
    const mappedFields = mappings
      .filter(m => m.databaseField !== 'skip' && m.databaseField !== '')
      .map(m => m.databaseField)

    requiredFields.forEach(field => {
      if (!mappedFields.includes(field)) {
        errors.push(`Required field "${DATABASE_FIELDS.find(f => f.value === field)?.label}" is not mapped`)
      }
    })

    // Check for duplicate mappings
    const fieldCounts: Record<string, number> = {}
    mappings.forEach(m => {
      if (m.databaseField && m.databaseField !== 'skip') {
        fieldCounts[m.databaseField] = (fieldCounts[m.databaseField] || 0) + 1
      }
    })

    Object.entries(fieldCounts).forEach(([field, count]) => {
      if (count > 1 && requiredFields.includes(field)) {
        errors.push(`Required field "${DATABASE_FIELDS.find(f => f.value === field)?.label}" is mapped multiple times`)
      }
    })

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  const handleComplete = () => {
    const validation = validateMappings()
    if (!validation.isValid) {
      toast({
        title: 'Mapping Validation Failed',
        description: validation.errors.join(', '),
        variant: 'error',
      })
      return
    }

    onMappingComplete(mappings)
  }

  const exportTemplate = (template: MappingTemplate) => {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.name.replace(/\s+/g, '_')}_mapping.json`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const importTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const template = JSON.parse(e.target?.result as string) as MappingTemplate
        setMappings(template.mappings)
        toast({
          title: 'Template Imported',
          description: `Template "${template.name}" has been loaded`,
        })
      } catch (error) {
        toast({
          title: 'Import Failed',
          description: 'Invalid template file format',
          variant: 'error',
        })
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Map each CSV column to a database field. Required fields must be mapped for the import to succeed.
        </AlertDescription>
      </Alert>

      {/* Template Management */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping Templates</CardTitle>
          <CardDescription>Save and reuse column mappings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSaveTemplate(!showSaveTemplate)}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Current Mapping
            </Button>
            <Label htmlFor="import-template" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Template
                </span>
              </Button>
              <input
                id="import-template"
                type="file"
                accept=".json"
                onChange={importTemplate}
                className="hidden"
              />
            </Label>
          </div>

          {showSaveTemplate && (
            <div className="p-4 border rounded-lg space-y-3">
              <div>
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Standard Card Format"
                />
              </div>
              <div>
                <Label htmlFor="template-desc">Description</Label>
                <Input
                  id="template-desc"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveTemplate}>
                  Save Template
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowSaveTemplate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {savedTemplates.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Saved Templates:</p>
              <div className="space-y-2">
                {savedTemplates.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      {t.description && (
                        <p className="text-sm text-muted-foreground">{t.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadTemplate(t)}
                      >
                        Load
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportTemplate(t)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTemplate(t.id!)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Mapping */}
      <Card>
        <CardHeader>
          <CardTitle>Column Mapping</CardTitle>
          <CardDescription>Map CSV columns to database fields</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {csvHeaders.map((header, index) => {
              const mapping = mappings.find(m => m.csvColumn === header) || {
                csvColumn: header,
                databaseField: '',
                required: false,
              }

              const fieldInfo = DATABASE_FIELDS.find(f => f.value === mapping.databaseField)
              const category = fieldInfo?.category || 'other'

              return (
                <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                  <GripVertical className="w-5 h-5 text-muted-foreground" />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Label className="font-medium">CSV Column:</Label>
                      <Badge variant="outline">{header}</Badge>
                    </div>
                    <Select
                      value={mapping.databaseField || ''}
                      onValueChange={(value) => updateMapping(header, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select database field..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_CATEGORIES.map(category => (
                          <div key={category.value}>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              {category.label}
                            </div>
                            {DATABASE_FIELDS
                              .filter(f => f.category === category.value)
                              .map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  <div className="flex items-center gap-2">
                                    <span>{field.label}</span>
                                    {field.required && (
                                      <Badge variant="outline" className="text-xs">Required</Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <ArrowRight className="w-5 h-5 text-muted-foreground" />

                  <div className="flex-1">
                    {mapping.databaseField && mapping.databaseField !== 'skip' ? (
                      <div className="flex items-center gap-2">
                        <Badge className={fieldInfo?.required ? 'bg-blue-500' : 'bg-gray-500'}>
                          {fieldInfo?.label || mapping.databaseField}
                        </Badge>
                        {fieldInfo?.required && (
                          <Badge variant="outline" className="text-xs">Required</Badge>
                        )}
                      </div>
                    ) : mapping.databaseField === 'skip' ? (
                      <Badge variant="outline" className="text-muted-foreground">Skipped</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Not mapped</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Validation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping Validation</CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const validation = validateMappings()
            return (
              <div className="space-y-4">
                {validation.isValid ? (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      All required fields are mapped. Ready to proceed!
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <p className="font-semibold mb-2">Mapping Issues:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {validation.errors.map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleComplete} disabled={!validation.isValid} className="flex-1">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirm Mapping
                  </Button>
                  {onCancel && (
                    <Button variant="outline" onClick={onCancel}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}

// Auto-detect column mappings based on common patterns
function autoDetectMappings(csvHeaders: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = []

  csvHeaders.forEach(header => {
    const normalized = header.toLowerCase().trim()
    let databaseField = ''

    // Name detection
    if (normalized.includes('name') && !normalized.includes('emergency')) {
      if (normalized.includes('first')) {
        databaseField = 'first_name'
      } else if (normalized.includes('last') || normalized.includes('surname')) {
        databaseField = 'last_name'
      } else {
        databaseField = 'full_name'
      }
    }
    // Age detection
    else if (normalized.includes('age')) {
      databaseField = 'age'
    }
    // Date of birth detection
    else if (normalized.includes('dob') || normalized.includes('date of birth') || 
             normalized.includes('birthdate') || normalized.includes('birth date')) {
      databaseField = 'date_of_birth'
    }
    // Gender detection
    else if (normalized.includes('gender') || normalized.includes('sex')) {
      databaseField = 'gender'
    }
    // Phone detection
    else if (normalized.includes('phone') || normalized.includes('mobile') || 
             normalized.includes('tel') || normalized.includes('contact')) {
      if (normalized.includes('emergency')) {
        databaseField = 'emergency_phone'
      } else {
        databaseField = 'phone'
      }
    }
    // Email detection
    else if (normalized.includes('email') || normalized.includes('e-mail')) {
      databaseField = 'email'
    }
    // Location/Address detection
    else if (normalized.includes('location') || normalized.includes('address') || 
             normalized.includes('residence') || normalized.includes('area')) {
      databaseField = 'location'
    }
    // OP number detection
    else if (normalized.includes('op') || normalized.includes('client') || 
             normalized.includes('patient number') || normalized.includes('patient_no')) {
      databaseField = 'patient_number'
    }
    // Emergency contact detection
    else if (normalized.includes('emergency') && normalized.includes('contact')) {
      databaseField = 'emergency_contact'
    }
    // Blood type detection
    else if (normalized.includes('blood')) {
      databaseField = 'blood_type'
    }
    // Allergies detection
    else if (normalized.includes('allerg')) {
      databaseField = 'allergies'
    }
    // Medical history detection
    else if (normalized.includes('medical') || normalized.includes('history')) {
      databaseField = 'medical_history'
    }
    // Insurance detection
    else if (normalized.includes('insurance')) {
      if (normalized.includes('number') || normalized.includes('no')) {
        databaseField = 'insurance_number'
      } else {
        databaseField = 'insurance_type'
      }
    }

    mappings.push({
      csvColumn: header,
      databaseField: databaseField || 'skip',
      required: ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone'].includes(databaseField),
    })
  })

  return mappings
}

