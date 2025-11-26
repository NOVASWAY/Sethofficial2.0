'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  ArrowLeft, 
  FileSpreadsheet, 
  Upload, 
  Eye, 
  Play, 
  CheckSquare,
  Download,
  AlertCircle,
  Info
} from 'lucide-react'
import { PatientImport } from './patient-import'

export type MigrationStep = 'preparation' | 'upload' | 'mapping' | 'validation' | 'import' | 'review'

interface MigrationWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface StepStatus {
  completed: boolean
  inProgress: boolean
  canProceed: boolean
}

export function MigrationWizard({ open, onOpenChange }: MigrationWizardProps) {
  const [currentStep, setCurrentStep] = useState<MigrationStep>('preparation')
  const [stepStatus, setStepStatus] = useState<Record<MigrationStep, StepStatus>>({
    preparation: { completed: false, inProgress: true, canProceed: false },
    upload: { completed: false, inProgress: false, canProceed: false },
    mapping: { completed: false, inProgress: false, canProceed: false },
    validation: { completed: false, inProgress: false, canProceed: false },
    import: { completed: false, inProgress: false, canProceed: false },
    review: { completed: false, inProgress: false, canProceed: false },
  })

  const steps: Array<{ id: MigrationStep; title: string; description: string }> = [
    { id: 'preparation', title: 'Data Preparation', description: 'Prepare your CSV file' },
    { id: 'upload', title: 'File Upload', description: 'Upload your patient data' },
    { id: 'mapping', title: 'Data Mapping', description: 'Map CSV columns' },
    { id: 'validation', title: 'Validation Review', description: 'Review and fix errors' },
    { id: 'import', title: 'Import Execution', description: 'Import data to system' },
    { id: 'review', title: 'Post-Import Review', description: 'Verify import results' },
  ]

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  const handleStepComplete = (step: MigrationStep) => {
    setStepStatus(prev => ({
      ...prev,
      [step]: { ...prev[step], completed: true, inProgress: false, canProceed: true },
    }))
  }

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1].id
      setCurrentStep(nextStep)
      setStepStatus(prev => ({
        ...prev,
        [currentStep]: { ...prev[currentStep], completed: true, inProgress: false },
        [nextStep]: { ...prev[nextStep], inProgress: true },
      }))
    }
  }

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      const prevStep = steps[currentStepIndex - 1].id
      setCurrentStep(prevStep)
      setStepStatus(prev => ({
        ...prev,
        [currentStep]: { ...prev[currentStep], inProgress: false },
        [prevStep]: { ...prev[prevStep], inProgress: true },
      }))
    }
  }

  const handleStepClick = (step: MigrationStep) => {
    const stepIdx = steps.findIndex(s => s.id === step)
    // Only allow clicking on completed steps or the next step
    if (stepIdx <= currentStepIndex || stepStatus[step].completed) {
      setCurrentStep(step)
      setStepStatus(prev => ({
        ...prev,
        [currentStep]: { ...prev[currentStep], inProgress: false },
        [step]: { ...prev[step], inProgress: true },
      }))
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'preparation':
        return <PreparationStep onComplete={() => handleStepComplete('preparation')} />
      case 'upload':
        return <UploadStep onComplete={() => handleStepComplete('upload')} />
      case 'mapping':
        return <MappingStep onComplete={() => handleStepComplete('mapping')} />
      case 'validation':
        return <ValidationStep onComplete={() => handleStepComplete('validation')} />
      case 'import':
        return <ImportStep onComplete={() => handleStepComplete('import')} />
      case 'review':
        return <ReviewStep onComplete={() => handleStepComplete('review')} />
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Migration Wizard</DialogTitle>
          <DialogDescription>
            Step-by-step guide to migrate patient data from cards to digital system
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Step {currentStepIndex + 1} of {steps.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicators */}
        <div className="grid grid-cols-6 gap-2 py-4">
          {steps.map((step, index) => {
            const status = stepStatus[step.id]
            const isActive = currentStep === step.id
            const isCompleted = status.completed
            const canClick = index <= currentStepIndex || isCompleted

            return (
              <button
                key={step.id}
                onClick={() => canClick && handleStepClick(step.id)}
                disabled={!canClick}
                className={`flex flex-col items-center gap-2 p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary/10 border-2 border-primary'
                    : isCompleted
                    ? 'bg-green-50 border-2 border-green-500'
                    : 'bg-muted border-2 border-transparent'
                } ${canClick ? 'cursor-pointer hover:bg-primary/5' : 'cursor-not-allowed opacity-50'}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : isActive ? (
                  <Circle className="w-6 h-6 text-primary fill-primary" />
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground" />
                )}
                <div className="text-center">
                  <p className={`text-xs font-medium ${isActive ? 'text-primary' : isCompleted ? 'text-green-700' : 'text-muted-foreground'}`}>
                    {step.title}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px] py-4">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStepIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {currentStepIndex < steps.length - 1 ? (
              <Button
                onClick={handleNext}
                disabled={!stepStatus[currentStep].canProceed}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={() => onOpenChange(false)}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Finish
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Step 1: Preparation
function PreparationStep({ onComplete }: { onComplete: () => void }) {
  const [checklist, setChecklist] = useState({
    csvPrepared: false,
    dataCleaned: false,
    templateReviewed: false,
    backupCreated: false,
  })

  const allChecked = Object.values(checklist).every(v => v)

  const handleCheck = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }))
    if (!allChecked && !checklist[key]) {
      // Check if all are now checked
      const newState = { ...checklist, [key]: true }
      if (Object.values(newState).every(v => v)) {
        setTimeout(onComplete, 100)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1: Data Preparation</CardTitle>
        <CardDescription>Prepare your CSV file for import</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Before importing, ensure your data is properly formatted and ready. Follow the checklist below.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="font-semibold">Preparation Checklist:</h4>
          
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              checked={checklist.csvPrepared}
              onChange={() => handleCheck('csvPrepared')}
              className="w-5 h-5"
            />
            <div className="flex-1">
              <p className="font-medium">CSV file prepared with patient data</p>
              <p className="text-sm text-muted-foreground">
                Ensure your file contains: Name, Age, Location, OP Number, Phone Number
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              checked={checklist.dataCleaned}
              onChange={() => handleCheck('dataCleaned')}
              className="w-5 h-5"
            />
            <div className="flex-1">
              <p className="font-medium">Data cleaned and validated</p>
              <p className="text-sm text-muted-foreground">
                Remove special characters, ensure UTF-8 encoding, verify phone numbers
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              checked={checklist.templateReviewed}
              onChange={() => handleCheck('templateReviewed')}
              className="w-5 h-5"
            />
            <div className="flex-1">
              <p className="font-medium">Template format reviewed</p>
              <p className="text-sm text-muted-foreground">
                Download and review the CSV template to ensure correct format
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
            <input
              type="checkbox"
              checked={checklist.backupCreated}
              onChange={() => handleCheck('backupCreated')}
              className="w-5 h-5"
            />
            <div className="flex-1">
              <p className="font-medium">Backup of original data created</p>
              <p className="text-sm text-muted-foreground">
                Keep a copy of your original CSV file as backup
              </p>
            </div>
          </label>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => {
            const template = `Name,Age,Location,OP Number,Phone Number
John Doe,45,Nairobi,123/06,0712345678
Mary Smith,32,Kiambu,456/10,0723456789`
            const blob = new Blob([template], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'patient_import_template.csv'
            a.click()
            window.URL.revokeObjectURL(url)
          }}>
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>
        </div>

        {allChecked && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              All preparation steps completed! You can proceed to the next step.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

// Step 2: Upload
function UploadStep({ onComplete }: { onComplete: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2: File Upload</CardTitle>
        <CardDescription>Upload your CSV file containing patient data</CardDescription>
      </CardHeader>
      <CardContent>
        <PatientImport />
        <Alert className="mt-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            After uploading, the system will automatically parse and validate your data.
            Review the preview before proceeding to the next step.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

// Step 3: Mapping (Placeholder - will be enhanced later)
function MappingStep({ onComplete }: { onComplete: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3: Data Mapping</CardTitle>
        <CardDescription>Map CSV columns to database fields</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            The system automatically detects common column names. If your CSV uses different column names,
            you can manually map them here.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Auto-detected mappings:
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">CSV Column: Name</p>
              <p className="text-xs text-muted-foreground">→ Database: first_name, last_name</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">CSV Column: Age</p>
              <p className="text-xs text-muted-foreground">→ Database: date_of_birth</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">CSV Column: OP Number</p>
              <p className="text-xs text-muted-foreground">→ Database: patient_number</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm font-medium">CSV Column: Phone Number</p>
              <p className="text-xs text-muted-foreground">→ Database: phone</p>
            </div>
          </div>
        </div>

        <Button onClick={onComplete} className="w-full">
          <CheckSquare className="w-4 h-4 mr-2" />
          Confirm Mapping
        </Button>
      </CardContent>
    </Card>
  )
}

// Step 4: Validation
function ValidationStep({ onComplete }: { onComplete: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4: Validation Review</CardTitle>
        <CardDescription>Review data validation results and fix any errors</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            Review the data preview shown in the upload step. Fix any errors before proceeding.
            Warnings can be addressed after import.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Validation Status</p>
              <p className="text-sm text-muted-foreground">Check the preview table for details</p>
            </div>
            <Badge variant="outline">Review Required</Badge>
          </div>
        </div>

        <Button onClick={onComplete} className="w-full">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Proceed to Import
        </Button>
      </CardContent>
    </Card>
  )
}

// Step 5: Import
function ImportStep({ onComplete }: { onComplete: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5: Import Execution</CardTitle>
        <CardDescription>Import your patient data into the system</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Play className="h-4 w-4" />
          <AlertDescription>
            Click the import button in the upload step to start importing your data.
            The import process will save all valid records to the database.
          </AlertDescription>
        </Alert>

        <div className="p-4 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium mb-2">Import Process:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Validates each record</li>
            <li>Checks for duplicates</li>
            <li>Saves to database</li>
            <li>Generates patient numbers</li>
            <li>Returns import results</li>
          </ul>
        </div>

        <Button onClick={onComplete} className="w-full">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Import Complete
        </Button>
      </CardContent>
    </Card>
  )
}

// Step 6: Review
function ReviewStep({ onComplete }: { onComplete: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 6: Post-Import Review</CardTitle>
        <CardDescription>Verify your import results</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Import completed successfully! Review the results and take any necessary actions.
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h4 className="font-semibold">Next Steps:</h4>
          
          <div className="p-3 border rounded-lg">
            <p className="font-medium mb-1">✓ Verify Imported Records</p>
            <p className="text-sm text-muted-foreground">
              Search for imported patients to verify they were imported correctly
            </p>
          </div>

          <div className="p-3 border rounded-lg">
            <p className="font-medium mb-1">✓ Update Missing Data</p>
            <p className="text-sm text-muted-foreground">
              Edit patient records to add any missing information
            </p>
          </div>

          <div className="p-3 border rounded-lg">
            <p className="font-medium mb-1">✓ Check for Duplicates</p>
            <p className="text-sm text-muted-foreground">
              Review duplicate warnings and merge if necessary
            </p>
          </div>
        </div>

        <Button onClick={onComplete} className="w-full">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Complete Migration
        </Button>
      </CardContent>
    </Card>
  )
}

