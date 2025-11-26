'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  FlaskConical, Save, CheckCircle2, AlertTriangle, 
  Upload, X, FileText
} from 'lucide-react'
import { labAPI, LabTestOrder, CreateLabTestResult } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface LabResultEntryProps {
  orderId: string
  onSuccess?: () => void
  onCancel?: () => void
}

// Test type configurations with reference ranges
const TEST_TYPE_CONFIGS: Record<string, {
  name: string
  fields: Array<{
    key: string
    label: string
    unit: string
    type: 'number' | 'text' | 'select'
    options?: string[]
    referenceRange?: { min: number; max: number }
  }>
}> = {
  'CBC': {
    name: 'Complete Blood Count',
    fields: [
      { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', type: 'number', referenceRange: { min: 12, max: 16 } },
      { key: 'hematocrit', label: 'Hematocrit', unit: '%', type: 'number', referenceRange: { min: 36, max: 48 } },
      { key: 'wbc', label: 'White Blood Cells', unit: '×10³/µL', type: 'number', referenceRange: { min: 4.5, max: 11 } },
      { key: 'rbc', label: 'Red Blood Cells', unit: '×10⁶/µL', type: 'number', referenceRange: { min: 4.5, max: 5.5 } },
      { key: 'platelets', label: 'Platelets', unit: '×10³/µL', type: 'number', referenceRange: { min: 150, max: 450 } },
      { key: 'mcv', label: 'Mean Corpuscular Volume', unit: 'fL', type: 'number', referenceRange: { min: 80, max: 100 } },
      { key: 'mch', label: 'Mean Corpuscular Hemoglobin', unit: 'pg', type: 'number', referenceRange: { min: 27, max: 31 } },
      { key: 'mchc', label: 'Mean Corpuscular Hemoglobin Concentration', unit: 'g/dL', type: 'number', referenceRange: { min: 32, max: 36 } },
    ],
  },
  'Urinalysis': {
    name: 'Urinalysis',
    fields: [
      { key: 'color', label: 'Color', unit: '', type: 'select', options: ['Yellow', 'Pale Yellow', 'Dark Yellow', 'Amber', 'Red', 'Brown', 'Other'] },
      { key: 'appearance', label: 'Appearance', unit: '', type: 'select', options: ['Clear', 'Slightly Cloudy', 'Cloudy', 'Turbid'] },
      { key: 'ph', label: 'pH', unit: '', type: 'number', referenceRange: { min: 5, max: 8 } },
      { key: 'specific_gravity', label: 'Specific Gravity', unit: '', type: 'number', referenceRange: { min: 1.003, max: 1.030 } },
      { key: 'protein', label: 'Protein', unit: 'mg/dL', type: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'] },
      { key: 'glucose', label: 'Glucose', unit: 'mg/dL', type: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+', '4+'] },
      { key: 'ketones', label: 'Ketones', unit: 'mg/dL', type: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+'] },
      { key: 'blood', label: 'Blood', unit: '', type: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+'] },
      { key: 'leukocytes', label: 'Leukocytes', unit: '', type: 'select', options: ['Negative', 'Trace', '1+', '2+', '3+'] },
      { key: 'nitrites', label: 'Nitrites', unit: '', type: 'select', options: ['Negative', 'Positive'] },
      { key: 'rbc_count', label: 'RBC Count', unit: '/HPF', type: 'number' },
      { key: 'wbc_count', label: 'WBC Count', unit: '/HPF', type: 'number' },
      { key: 'epithelial_cells', label: 'Epithelial Cells', unit: '/HPF', type: 'number' },
      { key: 'bacteria', label: 'Bacteria', unit: '', type: 'select', options: ['None', 'Few', 'Moderate', 'Many'] },
    ],
  },
  'Blood Glucose': {
    name: 'Blood Glucose',
    fields: [
      { key: 'glucose_level', label: 'Glucose Level', unit: 'mg/dL', type: 'number', referenceRange: { min: 70, max: 100 } },
      { key: 'test_type', label: 'Test Type', unit: '', type: 'select', options: ['Fasting', 'Random', 'Postprandial (2hr)', 'OGTT'] },
    ],
  },
}

export function LabResultEntry({ orderId, onSuccess, onCancel }: LabResultEntryProps) {
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [order, setOrder] = useState<LabTestOrder | null>(null)
  const [testValues, setTestValues] = useState<Record<string, any>>({})
  const [abnormalFlags, setAbnormalFlags] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])

  useEffect(() => {
    loadOrder()
  }, [orderId])

  useEffect(() => {
    checkAbnormalValues()
  }, [testValues, order])

  const loadOrder = async () => {
    try {
      setLoading(true)
      const orderData = await labAPI.getOrder(orderId)
      setOrder(orderData)
      
      // Initialize test values based on test type
      const config = TEST_TYPE_CONFIGS[orderData.test_type]
      if (config) {
        const initialValues: Record<string, any> = {}
        config.fields.forEach(field => {
          if (field.type === 'select' && field.options) {
            initialValues[field.key] = field.options[0] // Default to first option
          } else {
            initialValues[field.key] = ''
          }
        })
        setTestValues(initialValues)
      }
    } catch (error) {
      console.error('Error loading order:', error)
      toast({
        title: 'Error',
        description: 'Failed to load lab test order',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const checkAbnormalValues = () => {
    if (!order) return
    
    const config = TEST_TYPE_CONFIGS[order.test_type]
    if (!config) return

    const flags: Record<string, boolean> = {}
    config.fields.forEach(field => {
      if (field.referenceRange && testValues[field.key]) {
        const value = parseFloat(testValues[field.key])
        if (!isNaN(value)) {
          const isAbnormal = value < field.referenceRange.min || value > field.referenceRange.max
          flags[field.key] = isAbnormal
        }
      }
    })
    setAbnormalFlags(flags)
  }

  const handleValueChange = (key: string, value: any) => {
    setTestValues(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = async () => {
    if (!order) return

    try {
      setSaving(true)

      // Build reference ranges
      const config = TEST_TYPE_CONFIGS[order.test_type]
      const referenceRanges: Record<string, any> = {}
      if (config) {
        config.fields.forEach(field => {
          if (field.referenceRange) {
            referenceRanges[field.key] = {
              min: field.referenceRange.min,
              max: field.referenceRange.max,
              unit: field.unit,
            }
          }
        })
      }

      const resultData: CreateLabTestResult = {
        order_id: orderId,
        test_type: order.test_type,
        test_code: order.test_code,
        test_name: order.test_name,
        test_values: testValues,
        reference_ranges: Object.keys(referenceRanges).length > 0 ? referenceRanges : undefined,
        abnormal_flags: Object.keys(abnormalFlags).length > 0 ? abnormalFlags : undefined,
        notes: notes || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      }

      await labAPI.createResult(resultData)

      toast({
        title: 'Success',
        description: 'Lab test result saved successfully',
      })

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/dashboard/lab/results`)
      }
    } catch (error) {
      console.error('Error saving result:', error)
      toast({
        title: 'Error',
        description: 'Failed to save lab test result',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading order...</div>
      </div>
    )
  }

  if (!order) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Order not found</AlertDescription>
      </Alert>
    )
  }

  const config = TEST_TYPE_CONFIGS[order.test_type]
  const hasAbnormalValues = Object.values(abnormalFlags).some(flag => flag)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Enter Lab Test Result</h1>
          <p className="text-muted-foreground">
            Order: {order.order_number} - {order.test_name}
          </p>
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Result'}
          </Button>
        </div>
      </div>

      {/* Order Info */}
      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Order Number</Label>
              <p className="font-semibold">{order.order_number}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Test Type</Label>
              <p className="font-semibold">{order.test_name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Priority</Label>
              <p className="font-semibold">{order.priority}</p>
            </div>
            {order.clinical_indication && (
              <div>
                <Label className="text-muted-foreground">Clinical Indication</Label>
                <p>{order.clinical_indication}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Results Form */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>
            Enter test values below. Abnormal values will be flagged automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasAbnormalValues && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Some values are outside the normal reference range. Please review carefully.
              </AlertDescription>
            </Alert>
          )}

          {config ? (
            <div className="space-y-6">
              {config.fields.map((field) => {
                const isAbnormal = abnormalFlags[field.key]
                const value = testValues[field.key] || ''

                return (
                  <div key={field.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={field.key}>
                        {field.label}
                        {field.unit && <span className="text-muted-foreground ml-1">({field.unit})</span>}
                      </Label>
                      {field.referenceRange && (
                        <span className="text-xs text-muted-foreground">
                          Normal: {field.referenceRange.min} - {field.referenceRange.max} {field.unit}
                        </span>
                      )}
                    </div>
                    {field.type === 'select' && field.options ? (
                      <select
                        id={field.key}
                        value={value}
                        onChange={(e) => handleValueChange(field.key, e.target.value)}
                        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${isAbnormal ? 'border-orange-500' : ''}`}
                      >
                        {field.options.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type}
                        value={value}
                        onChange={(e) => handleValueChange(field.key, e.target.value)}
                        className={isAbnormal ? 'border-orange-500' : ''}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                    {isAbnormal && (
                      <div className="flex items-center gap-2 text-sm text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Value outside normal range</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Generic form for {order.test_type}. Please enter results manually.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Test Values (JSON)</Label>
                <Textarea
                  value={JSON.stringify(testValues, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value)
                      setTestValues(parsed)
                    } catch {
                      // Invalid JSON, keep as is
                    }
                  }}
                  rows={10}
                  placeholder='{"value1": "result1", "value2": "result2"}'
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter any additional notes or observations..."
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  )
}

