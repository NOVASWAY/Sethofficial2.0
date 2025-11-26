'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { 
  FlaskConical, CheckCircle2, AlertTriangle, 
  FileText, Download, Printer, Eye, Clock,
  User, Calendar, FileCheck
} from 'lucide-react'
import { labAPI, LabTestResult, LabTestOrder } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface LabResultViewerProps {
  resultId: string
  showActions?: boolean
  onBack?: () => void
}

export function LabResultViewer({ resultId, showActions = true, onBack }: LabResultViewerProps) {
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<LabTestResult | null>(null)
  const [order, setOrder] = useState<LabTestOrder | null>(null)

  useEffect(() => {
    loadResult()
  }, [resultId])

  const loadResult = async () => {
    try {
      setLoading(true)
      const resultData = await labAPI.getResult(resultId)
      setResult(resultData)
      
      // Load order information
      if (resultData.order_id) {
        try {
          const orderData = await labAPI.getOrder(resultData.order_id)
          setOrder(orderData)
        } catch (error) {
          console.error('Error loading order:', error)
        }
      }
    } catch (error) {
      console.error('Error loading result:', error)
      toast({
        title: 'Error',
        description: 'Failed to load lab test result',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!result) return

    try {
      await labAPI.verifyResult(resultId)
      toast({
        title: 'Success',
        description: 'Result verified successfully',
      })
      loadResult()
    } catch (error) {
      console.error('Error verifying result:', error)
      toast({
        title: 'Error',
        description: 'Failed to verify result',
        variant: 'destructive',
      })
    }
  }

  const handleReview = async () => {
    if (!result) return

    try {
      await labAPI.reviewResult(resultId)
      toast({
        title: 'Success',
        description: 'Result reviewed successfully',
      })
      loadResult()
    } catch (error) {
      console.error('Error reviewing result:', error)
      toast({
        title: 'Error',
        description: 'Failed to review result',
        variant: 'destructive',
      })
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      case 'verified':
        return <Badge variant="default" className="bg-green-600">Verified</Badge>
      case 'reviewed':
        return <Badge variant="default" className="bg-purple-500">Reviewed</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const isValueAbnormal = (key: string, value: any, referenceRanges?: Record<string, any>): boolean => {
    if (!referenceRanges || !referenceRanges[key]) return false
    const range = referenceRanges[key]
    if (typeof value === 'number' && range.min !== undefined && range.max !== undefined) {
      return value < range.min || value > range.max
    }
    return false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading result...</div>
      </div>
    )
  }

  if (!result) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Result not found</AlertDescription>
      </Alert>
    )
  }

  const hasAbnormalValues = result.abnormal_flags && Object.values(result.abnormal_flags).some(flag => flag === true)

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-3xl font-bold">Lab Test Result</h1>
          <p className="text-muted-foreground">
            {result.result_number} - {result.test_name}
          </p>
        </div>
        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          {showActions && (
            <>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              {result.status === 'pending' && (
                <Button onClick={handleVerify}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verify Result
                </Button>
              )}
              {result.status === 'verified' && (
                <Button onClick={handleReview}>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Review Result
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Result Status Alert */}
      {hasAbnormalValues && (
        <Alert className="border-orange-500">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription className="text-orange-700">
            This result contains values outside the normal reference range. Please review carefully.
          </AlertDescription>
        </Alert>
      )}

      {/* Result Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{result.test_name}</CardTitle>
              <CardDescription>
                Result Number: {result.result_number}
              </CardDescription>
            </div>
            {getStatusBadge(result.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Test Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Test Type</Label>
              <p className="font-semibold">{result.test_type}</p>
            </div>
            {result.test_code && (
              <div>
                <Label className="text-muted-foreground">Test Code</Label>
                <p className="font-semibold">{result.test_code}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Result Date</Label>
              <p className="font-semibold">
                {new Date(result.result_date).toLocaleString()}
              </p>
            </div>
            {result.verified_at && (
              <div>
                <Label className="text-muted-foreground">Verified At</Label>
                <p className="font-semibold">
                  {new Date(result.verified_at).toLocaleString()}
                </p>
              </div>
            )}
            {result.reviewed_at && (
              <div>
                <Label className="text-muted-foreground">Reviewed At</Label>
                <p className="font-semibold">
                  {new Date(result.reviewed_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {order && (
            <>
              <Separator />
              <div>
                <Label className="text-muted-foreground mb-2 block">Order Information</Label>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Order Number: </span>
                    <span className="font-semibold">{order.order_number}</span>
                  </div>
                  {order.clinical_indication && (
                    <div>
                      <span className="text-sm text-muted-foreground">Clinical Indication: </span>
                      <span>{order.clinical_indication}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Test Values */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(result.test_values).map(([key, value]) => {
              const isAbnormal = result.abnormal_flags?.[key] === true
              const referenceRange = result.reference_ranges?.[key]
              const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    isAbnormal ? 'border-orange-500 bg-orange-50' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{displayKey}</span>
                      {isAbnormal && (
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      )}
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {typeof value === 'number' ? value.toLocaleString() : String(value)}
                      {referenceRange?.unit && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          {referenceRange.unit}
                        </span>
                      )}
                    </div>
                    {referenceRange && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Reference Range: {referenceRange.min} - {referenceRange.max} {referenceRange.unit}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {result.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{result.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      {result.attachments && Array.isArray(result.attachments) && result.attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.attachments.map((attachment, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{attachment}</span>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification Status */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {getStatusBadge(result.status)}
            </div>
            {result.verified_by && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Verified By</span>
                <span className="text-sm font-semibold">User ID: {result.verified_by}</span>
              </div>
            )}
            {result.reviewed_by && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reviewed By</span>
                <span className="text-sm font-semibold">User ID: {result.reviewed_by}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

