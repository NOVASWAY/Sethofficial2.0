'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { 
  Activity, Thermometer, Heart, Scale, Ruler, 
  Wind, Save, X, CheckCircle2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { consultationAPI, patientAPI } from '@/lib/api-client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface VitalSigns {
  temperature?: number
  blood_pressure_systolic?: number
  blood_pressure_diastolic?: number
  pulse?: number
  respiratory_rate?: number
  oxygen_saturation?: number
  weight?: number
  height?: number
  bmi?: number
}

interface VitalSignsQuickEntryProps {
  patientId: string
  patientName?: string
  consultationId?: string
  onSave?: (vitals: VitalSigns) => void
  onCancel?: () => void
}

export function VitalSignsQuickEntry({ 
  patientId, 
  patientName,
  consultationId,
  onSave,
  onCancel 
}: VitalSignsQuickEntryProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [vitals, setVitals] = useState<VitalSigns>({})
  const [bloodPressure, setBloodPressure] = useState({ systolic: '', diastolic: '' })

  const calculateBMI = () => {
    if (vitals.weight && vitals.height) {
      const heightInMeters = vitals.height / 100
      const bmi = vitals.weight / (heightInMeters * heightInMeters)
      return parseFloat(bmi.toFixed(1))
    }
    return undefined
  }

  const getBMICategory = (bmi?: number): string => {
    if (!bmi) return ''
    if (bmi < 18.5) return 'Underweight'
    if (bmi < 25) return 'Normal'
    if (bmi < 30) return 'Overweight'
    return 'Obese'
  }

  const handleInputChange = (field: keyof VitalSigns, value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value)
    setVitals(prev => {
      const updated = { ...prev, [field]: numValue }
      // Auto-calculate BMI
      if (field === 'weight' || field === 'height') {
        updated.bmi = calculateBMI()
      }
      return updated
    })
  }

  const handleBloodPressureChange = (type: 'systolic' | 'diastolic', value: string) => {
    setBloodPressure(prev => ({ ...prev, [type]: value }))
    const numValue = value === '' ? undefined : parseFloat(value)
    if (type === 'systolic') {
      setVitals(prev => ({ ...prev, blood_pressure_systolic: numValue }))
    } else {
      setVitals(prev => ({ ...prev, blood_pressure_diastolic: numValue }))
    }
  }

  const validateVitals = (): boolean => {
    if (vitals.temperature !== undefined && (vitals.temperature < 30 || vitals.temperature > 45)) {
      toast({
        variant: 'error',
        title: 'Invalid Temperature',
        description: 'Temperature must be between 30°C and 45°C',
      })
      return false
    }

    if (vitals.pulse !== undefined && (vitals.pulse < 30 || vitals.pulse > 200)) {
      toast({
        variant: 'error',
        title: 'Invalid Pulse',
        description: 'Pulse must be between 30 and 200 bpm',
      })
      return false
    }

    if (vitals.respiratory_rate !== undefined && (vitals.respiratory_rate < 8 || vitals.respiratory_rate > 40)) {
      toast({
        variant: 'error',
        title: 'Invalid Respiratory Rate',
        description: 'Respiratory rate must be between 8 and 40 per minute',
      })
      return false
    }

    if (vitals.oxygen_saturation !== undefined && (vitals.oxygen_saturation < 70 || vitals.oxygen_saturation > 100)) {
      toast({
        variant: 'error',
        title: 'Invalid Oxygen Saturation',
        description: 'Oxygen saturation must be between 70% and 100%',
      })
      return false
    }

    if (vitals.blood_pressure_systolic !== undefined && 
        (vitals.blood_pressure_systolic < 50 || vitals.blood_pressure_systolic > 250)) {
      toast({
        variant: 'error',
        title: 'Invalid Blood Pressure',
        description: 'Systolic pressure must be between 50 and 250 mmHg',
      })
      return false
    }

    if (vitals.blood_pressure_diastolic !== undefined && 
        (vitals.blood_pressure_diastolic < 30 || vitals.blood_pressure_diastolic > 150)) {
      toast({
        variant: 'error',
        title: 'Invalid Blood Pressure',
        description: 'Diastolic pressure must be between 30 and 150 mmHg',
      })
      return false
    }

    return true
  }

  const handleSave = async () => {
    if (!validateVitals()) {
      return
    }

    setLoading(true)
    try {
      const vitalSignsData = {
        ...vitals,
        blood_pressure: vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic
          ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}`
          : undefined,
      }

      // If consultation ID is provided, update consultation
      if (consultationId) {
        await consultationAPI.update(consultationId, {
          vital_signs: vitalSignsData,
        })
      } else {
        // Otherwise, save to patient record (if API supports it)
        // For now, we'll just call the callback
        if (onSave) {
          onSave(vitals)
        }
      }

      toast({
        title: 'Vital Signs Saved',
        description: 'Vital signs have been recorded successfully.',
      })

      if (onSave) {
        onSave(vitals)
      }
    } catch (error) {
      console.error('Error saving vital signs:', error)
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Failed to save vital signs',
      })
    } finally {
      setLoading(false)
    }
  }

  const bmi = calculateBMI()
  const bmiCategory = getBMICategory(bmi)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Quick Vital Signs Entry
        </CardTitle>
        <CardDescription>
          {patientName ? `Recording vital signs for ${patientName}` : 'Enter patient vital signs'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Temperature */}
          <div className="space-y-2">
            <Label htmlFor="temperature" className="flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Temperature (°C)
            </Label>
            <Input
              id="temperature"
              type="number"
              step="0.1"
              value={vitals.temperature || ''}
              onChange={(e) => handleInputChange('temperature', e.target.value)}
              placeholder="36.5"
            />
            {vitals.temperature && (
              <p className="text-xs text-muted-foreground">
                {vitals.temperature < 36 ? 'Low' : vitals.temperature > 37.5 ? 'High' : 'Normal'}
              </p>
            )}
          </div>

          {/* Blood Pressure */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Blood Pressure (mmHg)
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Systolic"
                value={bloodPressure.systolic}
                onChange={(e) => handleBloodPressureChange('systolic', e.target.value)}
                className="flex-1"
              />
              <span className="self-center">/</span>
              <Input
                type="number"
                placeholder="Diastolic"
                value={bloodPressure.diastolic}
                onChange={(e) => handleBloodPressureChange('diastolic', e.target.value)}
                className="flex-1"
              />
            </div>
            {vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic && (
              <p className="text-xs text-muted-foreground">
                {vitals.blood_pressure_systolic < 90 || vitals.blood_pressure_diastolic < 60 
                  ? 'Low' 
                  : vitals.blood_pressure_systolic > 140 || vitals.blood_pressure_diastolic > 90
                  ? 'High'
                  : 'Normal'}
              </p>
            )}
          </div>

          {/* Pulse */}
          <div className="space-y-2">
            <Label htmlFor="pulse" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Pulse (bpm)
            </Label>
            <Input
              id="pulse"
              type="number"
              value={vitals.pulse || ''}
              onChange={(e) => handleInputChange('pulse', e.target.value)}
              placeholder="72"
            />
            {vitals.pulse && (
              <p className="text-xs text-muted-foreground">
                {vitals.pulse < 60 ? 'Low' : vitals.pulse > 100 ? 'High' : 'Normal'}
              </p>
            )}
          </div>

          {/* Respiratory Rate */}
          <div className="space-y-2">
            <Label htmlFor="respiratory_rate" className="flex items-center gap-2">
              <Wind className="h-4 w-4" />
              Respiratory Rate (/min)
            </Label>
            <Input
              id="respiratory_rate"
              type="number"
              value={vitals.respiratory_rate || ''}
              onChange={(e) => handleInputChange('respiratory_rate', e.target.value)}
              placeholder="16"
            />
            {vitals.respiratory_rate && (
              <p className="text-xs text-muted-foreground">
                {vitals.respiratory_rate < 12 ? 'Low' : vitals.respiratory_rate > 20 ? 'High' : 'Normal'}
              </p>
            )}
          </div>

          {/* Oxygen Saturation */}
          <div className="space-y-2">
            <Label htmlFor="oxygen_saturation">Oxygen Saturation (%)</Label>
            <Input
              id="oxygen_saturation"
              type="number"
              value={vitals.oxygen_saturation || ''}
              onChange={(e) => handleInputChange('oxygen_saturation', e.target.value)}
              placeholder="98"
            />
            {vitals.oxygen_saturation && (
              <p className="text-xs text-muted-foreground">
                {vitals.oxygen_saturation < 95 ? 'Low' : 'Normal'}
              </p>
            )}
          </div>

          {/* Weight */}
          <div className="space-y-2">
            <Label htmlFor="weight" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Weight (kg)
            </Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={vitals.weight || ''}
              onChange={(e) => handleInputChange('weight', e.target.value)}
              placeholder="70"
            />
          </div>

          {/* Height */}
          <div className="space-y-2">
            <Label htmlFor="height" className="flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Height (cm)
            </Label>
            <Input
              id="height"
              type="number"
              step="0.1"
              value={vitals.height || ''}
              onChange={(e) => handleInputChange('height', e.target.value)}
              placeholder="170"
            />
          </div>

          {/* BMI (calculated) */}
          <div className="space-y-2">
            <Label>BMI</Label>
            <div className="h-10 px-3 py-2 border rounded-md flex items-center">
              {bmi ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{bmi}</span>
                  {bmiCategory && (
                    <Badge variant={bmi < 18.5 || bmi >= 30 ? 'destructive' : bmi < 25 ? 'default' : 'secondary'}>
                      {bmiCategory}
                    </Badge>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">Enter weight and height</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Vital Signs'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

