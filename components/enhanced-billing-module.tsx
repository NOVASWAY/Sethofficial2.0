'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Receipt, CreditCard, Smartphone, Shield, DollarSign, 
  FileText, Printer, CheckCircle2, AlertCircle, Calculator, Plus, Trash2, Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { EnhancedServiceCatalog, Service } from './enhanced-service-catalog'
import { billingAPI, serviceCatalogAPI, invoiceAPI } from '@/lib/api-client'

interface BillingItem {
  service_id: string
  service_name: string
  price: number
  quantity: number
  total: number
}

interface AutoBillResponse {
  invoice_id: string
  patient_id: string
  insurance_type: string
  patient_type: string
  billing_items: BillingItem[]
  totals: {
    total_amount: number
    insurance_coverage: number
    patient_payment: number
  }
  created_at: string
}

interface EnhancedBillingModuleProps {
  patientId?: string
  patientName?: string
  consultationId?: string
  onInvoiceCreated?: (invoice: AutoBillResponse) => void
}

export function EnhancedBillingModule({ 
  patientId = '', 
  patientName = '', 
  consultationId = '',
  onInvoiceCreated 
}: EnhancedBillingModuleProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [insuranceType, setInsuranceType] = useState<'NHIF' | 'SHA' | 'Cash'>('Cash')
  const [patientType, setPatientType] = useState<'adult' | 'child' | 'senior'>('adult')
  const [autoBillResult, setAutoBillResult] = useState<AutoBillResponse | null>(null)
  const [notes, setNotes] = useState('')

  const handleServiceSelect = (service: Service) => {
    // Check if service is already selected
    if (selectedServices.find(s => s.id === service.id)) {
      toast({
        variant: 'error',
        title: 'Service Already Added',
        description: `${service.name} is already in the billing list`,
      })
      return
    }

    setSelectedServices(prev => [...prev, service])
    toast({
      title: 'Service Added',
      description: `${service.name} added to billing`,
    })
  }

  const handleRemoveService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId))
    toast({
      title: 'Service Removed',
      description: 'Service removed from billing',
    })
  }

  const handleCreateAutoBill = async () => {
    if (!patientId) {
      toast({
        variant: 'error',
        title: 'Patient Required',
        description: 'Please select a patient before creating a bill',
      })
      return
    }

    if (selectedServices.length === 0) {
      toast({
        variant: 'error',
        title: 'No Services Selected',
        description: 'Please select at least one service to bill',
      })
      return
    }

    setLoading(true)
    try {
      const serviceIds = selectedServices.map(s => s.id)
      const result = await billingAPI.createAutoBill(
        patientId,
        serviceIds,
        insuranceType,
        patientType
      )

      setAutoBillResult(result)
      
      toast({
        title: 'Auto-Bill Created Successfully',
        description: `Invoice ${result.invoice_id} generated with automated pricing`,
      })

      if (onInvoiceCreated) {
        onInvoiceCreated(result)
      }

    } catch (error) {
      console.error('Failed to create auto-bill:', error)
      toast({
        variant: 'error',
        title: 'Auto-Bill Creation Failed',
        description: 'Unable to create automated bill. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSelectedServices([])
    setAutoBillResult(null)
    setNotes('')
  }

  const calculateManualTotal = () => {
    return selectedServices.reduce((sum, service) => {
      const price = insuranceType === 'Cash' ? service.cash_price : 
                   insuranceType === 'NHIF' ? service.nhif_price : 
                   service.sha_price
      return sum + price
    }, 0)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Automated Billing</h2>
          <p className="text-muted-foreground">
            Create bills with automatic pricing based on insurance and patient type
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Service Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Patient</Label>
                  <p className="font-semibold">{patientName || 'No patient selected'}</p>
                  <p className="text-sm text-muted-foreground">{patientId || 'No ID'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Consultation</Label>
                  <p className="font-semibold">{consultationId || 'No consultation'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-semibold">{new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Insurance Type</Label>
                  <Select value={insuranceType} onValueChange={(value: any) => setInsuranceType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="NHIF">NHIF</SelectItem>
                      <SelectItem value="SHA">SHA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground">Patient Type</Label>
                  <Select value={patientType} onValueChange={(value: any) => setPatientType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adult">Adult</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Catalog */}
          <Card>
            <CardHeader>
              <CardTitle>Select Services</CardTitle>
              <CardDescription>
                Choose services from the catalog. Pricing will be calculated automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EnhancedServiceCatalog
                onServiceSelect={handleServiceSelect}
                showPricing={true}
                insuranceType={insuranceType}
                patientType={patientType}
              />
            </CardContent>
          </Card>

          {/* Selected Services */}
          {selectedServices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Selected Services</CardTitle>
                <CardDescription>
                  {selectedServices.length} service(s) selected for billing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedServices.map((service) => {
                    const price = insuranceType === 'Cash' ? service.cash_price : 
                                 insuranceType === 'NHIF' ? service.nhif_price : 
                                 service.sha_price
                    return (
                      <div key={service.id} className="flex justify-between items-center p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{service.name}</p>
                            {service.requires_prescription && (
                              <Badge variant="outline" className="text-xs">
                                Rx Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {service.description}
                          </p>
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className="font-medium">{insuranceType} Price:</span> KSh {price.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">KSh {price.toLocaleString()}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveService(service.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Separator className="my-4" />

                {/* Manual Total Calculation */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>KES {calculateManualTotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>VAT (16%)</span>
                    <span>KES {(calculateManualTotal() * 0.16).toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Estimated Total</span>
                    <span>KES {(calculateManualTotal() * 1.16).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Billing Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Automated Billing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold">Automated Pricing</p>
                    <p className="text-sm">
                      Prices are calculated automatically based on:
                    </p>
                    <ul className="text-xs list-disc list-inside space-y-1">
                      <li>Insurance type: {insuranceType}</li>
                      <li>Patient type: {patientType}</li>
                      <li>Service category rules</li>
                      <li>Current pricing policies</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional billing notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={handleCreateAutoBill} 
                  disabled={loading || selectedServices.length === 0 || !patientId}
                  className="w-full" 
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Auto-Bill...
                    </>
                  ) : (
                    <>
                      <Calculator className="mr-2 h-5 w-5" />
                      Create Automated Bill
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                  className="w-full"
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Auto-Bill Result */}
          {autoBillResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Generated Invoice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Invoice ID:</span>
                    <span className="font-mono">{autoBillResult.invoice_id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Patient ID:</span>
                    <span className="font-mono">{autoBillResult.patient_id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Insurance:</span>
                    <Badge variant="outline">{autoBillResult.insurance_type}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Patient Type:</span>
                    <Badge variant="outline">{autoBillResult.patient_type}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Amount:</span>
                    <span className="font-semibold">KES {autoBillResult.totals.total_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Insurance Coverage:</span>
                    <span className="text-green-600 font-semibold">KES {autoBillResult.totals.insurance_coverage.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Patient Payment:</span>
                    <span className="text-orange-600 font-semibold">KES {autoBillResult.totals.patient_payment.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Billing Items:</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {autoBillResult.billing_items.map((item, index) => (
                      <div key={index} className="flex justify-between text-xs p-2 bg-muted rounded">
                        <span className="truncate">{item.service_name}</span>
                        <span className="font-semibold">KES {item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <FileText className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                  
                  {autoBillResult.totals.patient_payment > 0 && (
                    <Button 
                      className="w-full" 
                      onClick={async () => {
                        try {
                          setLoading(true)
                          await invoiceAPI.processPayment(autoBillResult.invoice_id, {
                            payment_method: insuranceType.toLowerCase() === 'cash' ? 'cash' : 
                                          insuranceType.toLowerCase() === 'sha' ? 'sha' : 
                                          insuranceType.toLowerCase() === 'nhif' ? 'nhif' : 'cash',
                            amount_paid: autoBillResult.totals.patient_payment,
                            payment_date: new Date().toISOString().split('T')[0],
                            transaction_id: `TXN-${Date.now()}`,
                          })
                          toast({
                            title: "Payment Processed",
                            description: `Payment of KSh ${autoBillResult.totals.patient_payment.toFixed(2)} processed successfully.`,
                          })
                        } catch (error) {
                          console.error("Error processing payment:", error)
                          toast({
                            variant: 'error',
                            title: 'Payment Failed',
                            description: 'Failed to process payment. Please try again.',
                          })
                        } finally {
                          setLoading(false)
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Process Payment
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
