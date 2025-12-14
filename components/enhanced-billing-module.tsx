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
import { billingAPI, serviceCatalogAPI, invoiceAPI, shaClaimAPI, patientAPI } from '@/lib/api-client'
// Lightweight fallback for card payments while the real gateway component is offline
const PaymentGatewayIntegration = ({
  amount,
  currency,
  invoiceId,
  patientId,
  patientName,
  onSuccess,
  onError,
  onCancel,
}: {
  amount: number
  currency: string
  invoiceId: string
  patientId?: string
  patientName?: string
  onSuccess: (data: any) => void
  onError: (error: string) => void
  onCancel: () => void
}) => {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Demo card payment for {patientName || 'patient'} — {currency} {amount.toLocaleString()}
      </p>
      <div className="flex gap-2">
        <Button
          onClick={() =>
            onSuccess({
              amount,
              transactionId: `demo-${Date.now()}`,
              gateway: 'demo-gateway',
              cardDetails: { last4: '4242', brand: 'VISA' },
              metadata: { invoiceId, patientId },
            })
          }
        >
          Simulate Success
        </Button>
        <Button variant="outline" onClick={() => onError('Payment simulation failed')}>
          Simulate Error
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardSkeleton } from '@/components/ui/loading'

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
  role?: string // Add role prop for access control
}

export function EnhancedBillingModule({
  patientId = '',
  patientName = '',
  consultationId = '',
  onInvoiceCreated,
  role = 'receptionist' // Default to receptionist for backward compatibility
}: EnhancedBillingModuleProps) {
  // Only receptionists and admins can create invoices
  const canCreateInvoices = role === "receptionist" || role === "admin"
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [insuranceType, setInsuranceType] = useState<'NHIF' | 'SHA' | 'Cash' | 'Private' | 'Mixed'>('Cash')
  const [patientType, setPatientType] = useState<'adult' | 'child' | 'senior'>('adult')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa' | 'bank_transfer' | 'cheque' | 'card'>('cash')
  const [showCardPayment, setShowCardPayment] = useState(false)
  const [cardPaymentResult, setCardPaymentResult] = useState<any>(null)
  const [mpesaPhoneNumber, setMpesaPhoneNumber] = useState('')
  const [bankReference, setBankReference] = useState('')
  const [chequeNumber, setChequeNumber] = useState('')
  const [autoBillResult, setAutoBillResult] = useState<AutoBillResponse | null>(null)
  const [notes, setNotes] = useState('')
  // Ensure component is mounted to prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false)
  const patientPayment = autoBillResult?.totals?.patient_payment ?? 0
  const hasPatientPayment = patientPayment > 0

  useEffect(() => {
    setIsMounted(true)
  }, [])




  // Auto-load insurance type from patient when patientId is provided
  useEffect(() => {
    if (patientId) {
      patientAPI.getById(patientId)
        .then((patientData: any) => {
          const patientInsurance = patientData?.insurance_type || patientData?.insuranceType
          if (patientInsurance) {
            // Map patient insurance to billing insurance type
            const insuranceMap: Record<string, 'NHIF' | 'SHA' | 'Cash' | 'Private' | 'Mixed'> = {
              'nhif': 'NHIF',
              'NHIF': 'NHIF',
              'sha': 'SHA',
              'SHA': 'SHA',
              'private': 'Private',
              'Private': 'Private',
              'mixed': 'Mixed',
              'Mixed': 'Mixed',
              'cash': 'Cash',
              'Cash': 'Cash',
            }
            const mappedInsurance = insuranceMap[patientInsurance] || 'Cash'
            setInsuranceType(mappedInsurance)

            toast({
              title: 'Insurance Type Loaded',
              description: `Patient insurance type: ${mappedInsurance}${patientData?.insurance_number ? ` (${patientData.insurance_number})` : ''}`,
            })
          }
        })
        .catch((error: any) => {
          console.error('Failed to load patient insurance:', error)
          // Silently fail - user can manually select insurance type
        })
    }
  }, [patientId, toast])

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
        description: `Invoice ${result?.invoice_id || result?.data?.invoice_id || 'N/A'} generated with automated pricing`,
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
      let price = service.cash_price // Default to cash price
      if (insuranceType === 'SHA') {
        price = service.sha_price
      } else if (insuranceType === 'NHIF') {
        price = service.nhif_price || service.cash_price
      } else if (insuranceType === 'Private') {
        price = service.cash_price * 0.9 // 90% coverage
      } else if (insuranceType === 'Mixed') {
        price = service.sha_price * 0.7 // 70% coverage
      }
      return sum + price
    }, 0)
  }

  if (!isMounted) {
    return <DashboardSkeleton />
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
                      <SelectItem value="Cash">Cash (Self-Pay)</SelectItem>
                      <SelectItem value="NHIF">NHIF</SelectItem>
                      <SelectItem value="SHA">SHA (Social Health Authority)</SelectItem>
                      <SelectItem value="Private">Private Insurance</SelectItem>
                      <SelectItem value="Mixed">Mixed (SHA + Cash)</SelectItem>
                    </SelectContent>
                  </Select>
                  {patientId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {insuranceType === 'SHA' && 'Full coverage by SHA'}
                      {insuranceType === 'NHIF' && '80% coverage by NHIF, 20% patient pays'}
                      {insuranceType === 'Private' && '90% coverage by insurance, 10% patient pays'}
                      {insuranceType === 'Mixed' && '70% coverage, 30% patient pays'}
                      {insuranceType === 'Cash' && 'Patient pays full amount'}
                    </p>
                  )}
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
                {(insuranceType !== 'SHA' || hasPatientPayment) && (
                  <>
                    <div>
                      <Label className="text-muted-foreground">Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={(value: any) => setPaymentMethod(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="mpesa">M-Pesa</SelectItem>
                          <SelectItem value="card">Credit/Debit Card</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        How the patient will pay (insurance type only affects pricing)
                      </p>
                    </div>
                    {paymentMethod === 'mpesa' && (
                      <div>
                        <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
                        <Input
                          id="mpesa-phone"
                          type="tel"
                          placeholder="0712345678"
                          value={mpesaPhoneNumber}
                          onChange={(e) => setMpesaPhoneNumber(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter patient's M-Pesa registered phone number
                        </p>
                      </div>
                    )}
                    {paymentMethod === 'bank_transfer' && (
                      <div>
                        <Label htmlFor="bank-reference">Bank Transfer Reference Number</Label>
                        <Input
                          id="bank-reference"
                          type="text"
                          placeholder="Enter bank transfer reference"
                          value={bankReference}
                          onChange={(e) => setBankReference(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the bank transfer reference number for tracking
                        </p>
                      </div>
                    )}
                    {paymentMethod === 'cheque' && (
                      <div>
                        <Label htmlFor="cheque-number">Cheque Number</Label>
                        <Input
                          id="cheque-number"
                          type="text"
                          placeholder="Enter cheque number"
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter the cheque number for tracking
                        </p>
                      </div>
                    )}
                    {paymentMethod === 'card' && (
                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCardPayment(true)}
                          className="w-full"
                        >
                          <CreditCard className="mr-2 h-4 w-4" />
                          Process Card Payment
                        </Button>
                        {cardPaymentResult && (
                          <div className="mt-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <p className="text-sm text-green-800 dark:text-green-200">
                                Payment processed: {cardPaymentResult.transactionId}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
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
                    let price = service.cash_price // Default to cash price
                    if (insuranceType === 'SHA') {
                      price = service.sha_price
                    } else if (insuranceType === 'NHIF') {
                      price = service.nhif_price || service.cash_price
                    } else if (insuranceType === 'Private') {
                      price = service.cash_price * 0.9 // 90% coverage
                    } else if (insuranceType === 'Mixed') {
                      price = service.sha_price * 0.7 // 70% coverage
                    }
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
                {canCreateInvoices ? (
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
                ) : (
                  <div className="text-center p-4 text-muted-foreground">
                    <p className="text-sm">Only receptionists and administrators can create invoices.</p>
                    <p className="text-xs mt-2">You can view invoices in the Invoice Records section.</p>
                  </div>
                )}

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
                    <span className="font-mono">{autoBillResult?.invoice_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Patient ID:</span>
                    <span className="font-mono">{autoBillResult?.patient_id || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Insurance:</span>
                    <Badge variant="outline">{autoBillResult?.insurance_type || 'Cash'}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Patient Type:</span>
                    <Badge variant="outline">{autoBillResult?.patient_type || 'adult'}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Amount:</span>
                    <span className="font-semibold">KES {autoBillResult?.totals?.total_amount?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Insurance Coverage:</span>
                    <span className="text-green-600 font-semibold">KES {autoBillResult?.totals?.insurance_coverage?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Patient Payment:</span>
                    <span className="text-orange-600 font-semibold">KES {patientPayment.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Billing Items:</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {autoBillResult?.billing_items?.map((item, index) => (
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

                  {hasPatientPayment && (
                    <Button
                      className="w-full"
                      onClick={async () => {
                        try {
                          setLoading(true)
                          // Use selected payment method (insurance type only affects pricing, not payment method)
                          // Backend only accepts: 'cash', 'mpesa', 'bank_transfer', 'cheque'
                          // Insurance type (SHA/NHIF) determines pricing but payment_method is how patient actually pays

                          // Validate M-Pesa phone number if needed
                          if (paymentMethod === 'mpesa') {
                            if (!mpesaPhoneNumber || !/^(\+?254|0)?[17]\d{8}$/.test(mpesaPhoneNumber.replace(/\s+/g, ''))) {
                              toast({
                                variant: 'error',
                                title: 'Invalid Phone Number',
                                description: 'Please enter a valid M-Pesa registered phone number (e.g., 0712345678)',
                              })
                              setLoading(false)
                              return
                            }
                          }

                          const paymentData: any = {
                            payment_method: paymentMethod,
                            amount_paid: patientPayment,
                            payment_date: new Date().toISOString().split('T')[0],
                            transaction_id: `TXN-${Date.now()}`,
                          }

                          // Add phone number for M-Pesa payments
                          if (paymentMethod === 'mpesa' && mpesaPhoneNumber) {
                            paymentData.phone_number = mpesaPhoneNumber.replace(/\s+/g, '')
                          }

                          // Add reference number for bank transfer
                          if (paymentMethod === 'bank_transfer' && bankReference) {
                            paymentData.reference_number = bankReference
                          }

                          // Add cheque number for cheque payments
                          if (paymentMethod === 'cheque' && chequeNumber) {
                            paymentData.reference_number = chequeNumber
                          }

                          await invoiceAPI.processPayment(autoBillResult?.invoice_id || '', paymentData)
                          toast({
                            title: "Payment Processed",
                            description: `Payment of KSh ${(autoBillResult?.totals?.patient_payment || 0).toFixed(2)} processed successfully.`,
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

      {/* Card Payment Dialog */}
      <Dialog open={showCardPayment} onOpenChange={setShowCardPayment}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Card Payment</DialogTitle>
            <DialogDescription>
              Process payment via credit or debit card
            </DialogDescription>
          </DialogHeader>
          {autoBillResult && (
            <PaymentGatewayIntegration
              amount={patientPayment}
              currency="KES"
              invoiceId={autoBillResult?.invoice_id || ''}
              patientId={patientId}
              patientName={patientName}
              onSuccess={async (paymentData) => {
                setCardPaymentResult(paymentData)
                setShowCardPayment(false)

                // Process the payment through the invoice API
                try {
                  const paymentDataForAPI = {
                    payment_method: 'card',
                    amount: paymentData.amount,
                    payment_reference: paymentData.transactionId,
                    gateway_name: paymentData.gateway,
                    gateway_transaction_id: paymentData.transactionId,
                    card_last4: paymentData.cardDetails?.last4,
                    card_brand: paymentData.cardDetails?.brand,
                    metadata: paymentData.metadata
                  }

                  await invoiceAPI.processPayment(autoBillResult?.invoice_id || '', paymentDataForAPI)

                  toast({
                    title: "Payment Processed",
                    description: `Card payment of KSh ${paymentData.amount.toLocaleString()} processed successfully.`,
                  })
                } catch (error) {
                  console.error("Error processing card payment:", error)
                  toast({
                    variant: 'error',
                    title: 'Payment Recording Failed',
                    description: 'Payment was successful but failed to record. Please contact support.',
                  })
                }
              }}
              onError={(error) => {
                toast({
                  variant: 'error',
                  title: 'Payment Failed',
                  description: error,
                })
              }}
              onCancel={() => setShowCardPayment(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default EnhancedBillingModule
