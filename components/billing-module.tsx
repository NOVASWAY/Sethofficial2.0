'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Receipt, CreditCard, Smartphone, Shield, DollarSign, 
  FileText, Printer, Send, CheckCircle2, AlertCircle, Calculator, Plus, Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { defaultServices, type Service } from './service-catalog'
import { useWorkflow } from '@/contexts/workflow-context'
import { useInvoices } from '@/contexts/invoice-context'
import { useMpesa } from '@/hooks/use-mpesa'
import { useEffect } from 'react'

interface InvoiceItem {
  id: string
  type: 'service' | 'medication' | 'procedure'
  description: string
  quantity: number
  unit_price: number
  total_price: number
  sha_covered: boolean
  sha_amount: number
  patient_amount: number
}

interface PaymentAllocation {
  type: 'sha' | 'cash' | 'mpesa'
  amount: number
  reference?: string
}

export function BillingModule() {
  const { toast } = useToast()
  const { pendingConsultation, setPendingConsultation } = useWorkflow()
  const { addInvoice, addPayment } = useInvoices()
  const { 
    isProcessing: mpesaProcessing, 
    currentTransaction, 
    transactionStatus,
    initiatePayment, 
    pollTransactionStatus, 
    clearTransaction,
    validatePhoneNumber,
    formatAmount,
    getStatusColor,
    getStatusIcon
  } = useMpesa()
  const [paymentType, setPaymentType] = useState<'sha' | 'cash' | 'mpesa' | 'mixed'>('cash')
  const [loading, setLoading] = useState(false)
  
  const [invoiceData, setInvoiceData] = useState({
    patient_id: '',
    patient_name: '',
    consultation_id: '',
    sha_number: '',
    notes: '',
  })

  const [items, setItems] = useState<InvoiceItem[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [serviceQuantity, setServiceQuantity] = useState<string>('1')

  // Auto-populate from consultation
  useEffect(() => {
    if (pendingConsultation) {
      // Update invoice data
      setInvoiceData({
        patient_id: pendingConsultation.patient_id,
        patient_name: pendingConsultation.patient_name,
        consultation_id: pendingConsultation.consultation_id,
        sha_number: invoiceData.sha_number, // Keep existing or could be from patient
        notes: pendingConsultation.notes || '',
      })

      // Set payment type based on insurance
      if (pendingConsultation.insurance_type) {
        setPaymentType(pendingConsultation.insurance_type)
      }

      // Add services from consultation
      const serviceItems: InvoiceItem[] = pendingConsultation.services.map(service => ({
        id: crypto.randomUUID(),
        type: 'service' as const,
        description: service.service_name,
        quantity: 1,
        unit_price: service.unit_price,
        total_price: service.unit_price,
        sha_covered: pendingConsultation.insurance_type === 'sha' || pendingConsultation.insurance_type === 'mixed',
        sha_amount: pendingConsultation.insurance_type === 'sha' || pendingConsultation.insurance_type === 'mixed' ? service.unit_price * 0.8 : 0,
        patient_amount: pendingConsultation.insurance_type === 'sha' || pendingConsultation.insurance_type === 'mixed' ? service.unit_price * 0.2 : service.unit_price,
      }))

      setItems(serviceItems)

      toast({
        title: 'Consultation Loaded',
        description: `${serviceItems.length} service(s) added from consultation`,
      })

      // Clear pending consultation after loading
      setPendingConsultation(null)
    }
  }, [pendingConsultation, setPendingConsultation, toast])

  const [paymentAllocations, setPaymentAllocations] = useState<PaymentAllocation[]>([])
  const [mpesaCode, setMpesaCode] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState('')
  const [cashReceived, setCashReceived] = useState('')

  // Add service from catalog
  const handleAddService = () => {
    if (!selectedServiceId) {
      toast({
        variant: 'error',
        title: 'No Service Selected',
        description: 'Please select a service from the catalog',
      })
      return
    }

    const service = defaultServices.find(s => s.id === selectedServiceId)
    if (!service) return

    const quantity = parseInt(serviceQuantity) || 1
    const isSHA = paymentType === 'sha' || paymentType === 'mixed'
    const unitPrice = isSHA && service.shaPrice ? service.shaPrice : service.price
    const totalPrice = unitPrice * quantity

    const newItem: InvoiceItem = {
      id: crypto.randomUUID(),
      type: 'service',
      description: service.name,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      sha_covered: isSHA,
      sha_amount: isSHA && service.shaPrice ? service.shaPrice * quantity : 0,
      patient_amount: isSHA && service.shaPrice ? (service.price - service.shaPrice) * quantity : totalPrice,
    }

    setItems([...items, newItem])
    setSelectedServiceId('')
    setServiceQuantity('1')

    toast({
      title: 'Service Added',
      description: `${service.name} added to invoice`,
    })
  }

  // Remove item from invoice
  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId))
    toast({
      title: 'Item Removed',
      description: 'Item removed from invoice',
    })
  }

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total_price, 0)
    const tax = subtotal * 0.16 // 16% VAT
    const total = subtotal + tax
    const shaTotal = items.reduce((sum, item) => sum + (item.sha_covered ? item.sha_amount : 0), 0)
    const patientTotal = items.reduce((sum, item) => sum + item.patient_amount, 0)

    return { subtotal, tax, total, shaTotal, patientTotal }
  }

  const totals = calculateTotals()

  const handlePaymentTypeChange = (type: 'sha' | 'cash' | 'mpesa' | 'mixed') => {
    setPaymentType(type)
    setPaymentAllocations([])
    clearTransaction() // Clear any existing M-Pesa transaction
    
    // Auto-calculate default allocations
    if (type === 'sha') {
      setPaymentAllocations([{ type: 'sha', amount: totals.total }])
    } else if (type === 'cash') {
      setPaymentAllocations([{ type: 'cash', amount: totals.total }])
    } else if (type === 'mpesa') {
      setPaymentAllocations([{ type: 'mpesa', amount: totals.total }])
    } else if (type === 'mixed') {
      setPaymentAllocations([
        { type: 'sha', amount: totals.shaTotal },
        { type: 'cash', amount: totals.patientTotal },
      ])
    }
  }

  const handleMpesaPayment = async () => {
    if (!mpesaPhone || totals.total <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid phone number and ensure total amount is greater than 0",
        variant: "error",
      })
      return
    }

    // Validate phone number
    const phoneValidation = validatePhoneNumber(mpesaPhone)
    if (!phoneValidation.isValid) {
      toast({
        title: "Invalid Phone Number",
        description: phoneValidation.error || "Please enter a valid phone number",
        variant: "error",
      })
      return
    }

    // Generate invoice ID for reference
    const invoiceId = `INV-${Date.now()}`
    
    const stkPushRequest = {
      phone_number: phoneValidation.formatted,
      amount: Math.round(totals.total * 100), // Convert to cents
      account_reference: invoiceId,
      transaction_desc: `Payment for ${invoiceData.patient_name} - Invoice ${invoiceId}`,
      invoice_id: invoiceId,
    }

    const success = await initiatePayment(stkPushRequest)
    
    if (success) {
      // Start polling for status updates
      setTimeout(() => {
        if (currentTransaction) {
          pollTransactionStatus(currentTransaction.checkout_request_id)
        }
      }, 5000) // Poll after 5 seconds
    }
  }

  const generateInvoiceNumber = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `INV-${year}${month}-${random}`
  }

  const handleGenerateInvoice = async () => {
    setLoading(true)
    try {
      // Validate payment allocations
      const totalAllocated = paymentAllocations.reduce((sum, p) => sum + p.amount, 0)
      if (Math.abs(totalAllocated - totals.total) > 0.01) {
        toast({
          variant: 'error',
          title: 'Payment Validation Error',
          description: `Total payment (${totalAllocated.toFixed(2)}) must equal invoice total (${totals.total.toFixed(2)})`,
        })
        setLoading(false)
        return
      }

      // Validate M-Pesa details if M-Pesa payment
      if (paymentAllocations.some(p => p.type === 'mpesa')) {
        if (!currentTransaction) {
          toast({
            variant: 'error',
            title: 'M-Pesa Payment Required',
            description: 'Please initiate M-Pesa payment before generating invoice',
          })
          setLoading(false)
          return
        }
        
        if (currentTransaction.status !== 'Completed') {
          toast({
            variant: 'error',
            title: 'M-Pesa Payment Incomplete',
            description: 'M-Pesa payment must be completed before generating invoice',
          })
          setLoading(false)
          return
        }
      }

      // Create invoice using Invoice Context
      const newInvoice = addInvoice({
        patientId: invoiceData.patient_id,
        patientName: invoiceData.patient_name,
        date: new Date().toISOString().split('T')[0],
        items: items.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          category: item.type,
        })),
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: 0,
        total: totals.total,
        amountPaid: totals.total,
        balance: 0,
        paymentMethod: paymentType === 'mpesa' ? 'cash' : paymentType as any,
        paymentStatus: 'paid',
        invoiceType: paymentType === 'mixed' ? 'mixed' : (paymentType === 'mpesa' ? 'cash' : paymentType),
        notes: invoiceData.notes,
        shaClaimNumber: paymentType === 'sha' || paymentType === 'mixed' ? invoiceData.sha_number : undefined,
        mpesaTransactionCode: currentTransaction?.mpesa_receipt_number || mpesaCode,
        createdBy: 'System User', // TODO: Get from auth context
        consultationId: invoiceData.consultation_id,
      })

      // Record payments for each allocation
      for (const allocation of paymentAllocations) {
        addPayment({
          invoiceId: newInvoice.id,
          invoiceNumber: newInvoice.invoiceNumber,
          amount: allocation.amount,
          method: allocation.type as any,
          reference: allocation.reference,
          transactionCode: allocation.type === 'mpesa' ? (currentTransaction?.mpesa_receipt_number || mpesaCode) : undefined,
          date: new Date().toISOString().split('T')[0],
          receivedBy: 'System User', // TODO: Get from auth context
          notes: `Payment via ${allocation.type}`,
        })
      }

      toast({
        title: 'Invoice Generated Successfully',
        description: `Invoice ${newInvoice.invoiceNumber} created and saved`,
      })

      // Clear consultation from workflow
      setPendingConsultation(null)

      // Auto-generate SHA claim if applicable
      if (paymentType === 'sha' || paymentType === 'mixed') {
        handleGenerateShaClaim(newInvoice.invoiceNumber)
      }

      // Reset form
      setItems([])
      setPaymentAllocations([{ type: 'cash', amount: 0 }])
      setMpesaCode('')
      setMpesaPhone('')
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Invoice Generation Failed',
        description: 'Unable to generate invoice. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateShaClaim = async (invoiceNumber: string) => {
    try {
      const claimPayload = {
        claim_number: `SHA-${invoiceNumber.split('-')[1]}-${Math.floor(Math.random() * 1000)}`,
        invoice_number: invoiceNumber,
        patient_name: invoiceData.patient_name,
        patient_sha_number: invoiceData.sha_number,
        claim_date: new Date().toISOString().split('T')[0],
        service_date: new Date().toISOString().split('T')[0],
        total_amount: totals.shaTotal,
        status: 'pending',
      }

      // TODO: Replace with actual API call
      // await fetch('/api/sha-claims', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(claimPayload),
      // })

      toast({
        title: 'SHA Claim Created',
        description: `Claim ${claimPayload.claim_number} generated for submission`,
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: 'SHA Claim Generation Failed',
        description: 'Invoice created but SHA claim failed. Please create manually.',
      })
    }
  }

  const calculateChange = () => {
    const received = parseFloat(cashReceived) || 0
    return received - totals.total
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Billing & Invoicing</h2>
          <p className="text-muted-foreground">
            Generate invoices and process payments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Patient</Label>
                  <p className="font-semibold">{invoiceData.patient_name}</p>
                  <p className="text-sm text-muted-foreground">{invoiceData.patient_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Consultation</Label>
                  <p className="font-semibold">{invoiceData.consultation_id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-semibold">{new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">SHA Number</Label>
                  <p className="font-semibold">{invoiceData.sha_number}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Items</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Add Service from Catalog */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50 mb-4">
                <Label className="font-semibold">Add Service from Catalog</Label>
                <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-7">
                    <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a service..." />
                      </SelectTrigger>
                      <SelectContent>
                        {defaultServices
                          .filter(s => s.isActive)
                          .map((service) => {
                            const price = (paymentType === 'sha' || paymentType === 'mixed') && service.shaPrice 
                              ? service.shaPrice 
                              : service.price
                            return (
                              <SelectItem key={service.id} value={service.id}>
                                <div className="flex justify-between items-center w-full">
                                  <span>{service.name}</span>
                                  <span className="ml-4 text-muted-foreground">KSh {price.toLocaleString()}</span>
                                </div>
                              </SelectItem>
                            )
                          })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      value={serviceQuantity}
                      onChange={(e) => setServiceQuantity(e.target.value)}
                      placeholder="Qty"
                    />
                  </div>
                  <div className="col-span-3">
                    <Button onClick={handleAddService} className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>
                {selectedServiceId && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {(() => {
                        const service = defaultServices.find(s => s.id === selectedServiceId)
                        if (!service) return null
                        const qty = parseInt(serviceQuantity) || 1
                        const price = (paymentType === 'sha' || paymentType === 'mixed') && service.shaPrice 
                          ? service.shaPrice 
                          : service.price
                        return `Adding: ${service.name} × ${qty} = KSh ${(price * qty).toLocaleString()}`
                      })()}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Invoice Items List */}
              <div className="space-y-3">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No items added yet</p>
                    <p className="text-sm">Select services from the catalog above</p>
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{item.description}</p>
                          {item.sha_covered && (
                            <Badge variant="outline" className="text-xs">
                              <Shield className="h-3 w-3 mr-1" />
                              SHA
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Qty: {item.quantity} × KSh {item.unit_price.toFixed(2)}
                        </p>
                        {item.sha_covered && (
                          <div className="text-xs text-muted-foreground mt-1">
                            SHA: KSh {item.sha_amount.toFixed(2)} | Patient: KSh {item.patient_amount.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">KSh {item.total_price.toFixed(2)}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Separator className="my-4" />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>KES {totals.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>VAT (16%)</span>
                  <span>KES {totals.tax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>KES {totals.total.toFixed(2)}</span>
                </div>
                {(paymentType === 'sha' || paymentType === 'mixed') && (
                  <>
                    <Separator />
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-primary">
                        <span className="flex items-center gap-1">
                          <Shield className="h-4 w-4" />
                          SHA Coverage
                        </span>
                        <span className="font-semibold">KES {totals.shaTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-orange-600">
                        <span>Patient Amount</span>
                        <span className="font-semibold">KES {totals.patientTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Payment */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={paymentType === 'cash' ? 'default' : 'outline'}
                  onClick={() => handlePaymentTypeChange('cash')}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                >
                  <DollarSign className="h-6 w-6" />
                  <span>Cash</span>
                </Button>
                <Button
                  variant={paymentType === 'mpesa' ? 'default' : 'outline'}
                  onClick={() => handlePaymentTypeChange('mpesa')}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                >
                  <Smartphone className="h-6 w-6" />
                  <span>M-Pesa</span>
                </Button>
                <Button
                  variant={paymentType === 'sha' ? 'default' : 'outline'}
                  onClick={() => handlePaymentTypeChange('sha')}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                >
                  <Shield className="h-6 w-6" />
                  <span>SHA</span>
                </Button>
                <Button
                  variant={paymentType === 'mixed' ? 'default' : 'outline'}
                  onClick={() => handlePaymentTypeChange('mixed')}
                  className="flex flex-col items-center gap-2 h-auto py-4"
                >
                  <Calculator className="h-6 w-6" />
                  <span>Mixed</span>
                </Button>
              </div>

              {/* Payment-specific fields */}
              {paymentType === 'cash' && (
                <div className="space-y-4">
                  <Alert>
                    <DollarSign className="h-4 w-4" />
                    <AlertDescription>
                      Cash Payment: KES {totals.total.toFixed(2)}
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label>Cash Received</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Amount received"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                    />
                  </div>
                  {cashReceived && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Change Due:</span>
                        <span className={`text-lg font-bold ${calculateChange() < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          KES {Math.abs(calculateChange()).toFixed(2)}
                        </span>
                      </div>
                      {calculateChange() < 0 && (
                        <p className="text-xs text-red-600 mt-1">Insufficient payment</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {paymentType === 'mpesa' && (
                <div className="space-y-4">
                  <Alert>
                    <Smartphone className="h-4 w-4" />
                    <AlertDescription>
                      M-Pesa Payment: {formatAmount(totals.total * 100)}
                    </AlertDescription>
                  </Alert>
                  
                  {!currentTransaction ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Phone Number *</Label>
                        <Input
                          placeholder="+254712345678 or 0712345678"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          disabled={mpesaProcessing}
                        />
                        <p className="text-sm text-muted-foreground">
                          Enter the phone number registered with M-Pesa
                        </p>
                      </div>
                      
                      <Button 
                        onClick={handleMpesaPayment}
                        disabled={mpesaProcessing || !mpesaPhone || totals.total <= 0}
                        className="w-full"
                      >
                        {mpesaProcessing ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Initiating Payment...
                          </>
                        ) : (
                          <>
                            <Smartphone className="h-4 w-4 mr-2" />
                            Send Payment Request
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">Payment Status</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(currentTransaction.status)}`}>
                            {getStatusIcon(currentTransaction.status)} {currentTransaction.status}
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div>Amount: {formatAmount(currentTransaction.amount)}</div>
                          <div>Phone: {currentTransaction.phone_number}</div>
                          <div>Reference: {currentTransaction.account_reference}</div>
                          {currentTransaction.mpesa_receipt_number && (
                            <div>Receipt: {currentTransaction.mpesa_receipt_number}</div>
                          )}
                        </div>
                        
                        {currentTransaction.status === 'Pending' && (
                          <div className="mt-3">
                            <div className="flex items-center text-sm text-yellow-600">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                              Waiting for payment confirmation...
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => pollTransactionStatus(currentTransaction.checkout_request_id)}
                          disabled={mpesaProcessing}
                          className="flex-1"
                        >
                          {mpesaProcessing ? 'Checking...' : 'Check Status'}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={clearTransaction}
                          disabled={mpesaProcessing}
                        >
                          New Payment
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {paymentType === 'sha' && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-semibold">SHA Insurance Coverage</p>
                      <p>Total Amount: KES {totals.total.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        A SHA claim will be automatically generated for submission
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {paymentType === 'mixed' && (
                <div className="space-y-4">
                  <Alert>
                    <Calculator className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-semibold">Mixed Payment</p>
                        <p className="text-sm">SHA: KES {totals.shaTotal.toFixed(2)}</p>
                        <p className="text-sm">Patient: KES {totals.patientTotal.toFixed(2)}</p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>Patient Payment Method</Label>
                    <Select 
                      onValueChange={(value) => {
                        const allocation = paymentAllocations.find(p => p.type === 'cash' || p.type === 'mpesa')
                        if (allocation) {
                          setPaymentAllocations(prev => [
                            ...prev.filter(p => p.type === 'sha'),
                            { type: value as 'cash' | 'mpesa', amount: totals.patientTotal }
                          ])
                        }
                        clearTransaction() // Clear M-Pesa transaction when switching methods
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentAllocations.some(p => p.type === 'mpesa') && (
                    <div className="space-y-4">
                      {!currentTransaction ? (
                        <>
                          <div className="space-y-2">
                            <Label>Phone Number *</Label>
                            <Input
                              placeholder="+254712345678 or 0712345678"
                              value={mpesaPhone}
                              onChange={(e) => setMpesaPhone(e.target.value)}
                              disabled={mpesaProcessing}
                            />
                          </div>
                          
                          <Button 
                            onClick={handleMpesaPayment}
                            disabled={mpesaProcessing || !mpesaPhone || totals.patientTotal <= 0}
                            className="w-full"
                            size="sm"
                          >
                            {mpesaProcessing ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Initiating...
                              </>
                            ) : (
                              <>
                                <Smartphone className="h-4 w-4 mr-2" />
                                Send M-Pesa Request
                              </>
                            )}
                          </Button>
                        </>
                      ) : (
                        <div className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">M-Pesa Status</span>
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(currentTransaction.status)}`}>
                              {getStatusIcon(currentTransaction.status)} {currentTransaction.status}
                            </span>
                          </div>
                          
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>Amount: {formatAmount(currentTransaction.amount)}</div>
                            <div>Phone: {currentTransaction.phone_number}</div>
                            {currentTransaction.mpesa_receipt_number && (
                              <div>Receipt: {currentTransaction.mpesa_receipt_number}</div>
                            )}
                          </div>
                          
                          <div className="flex gap-2 mt-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => pollTransactionStatus(currentTransaction.checkout_request_id)}
                              disabled={mpesaProcessing}
                              className="flex-1"
                            >
                              Check
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={clearTransaction}
                              disabled={mpesaProcessing}
                            >
                              New
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={invoiceData.notes}
                  onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Button onClick={handleGenerateInvoice} disabled={loading} className="w-full" size="lg">
              <Receipt className="mr-2 h-5 w-5" />
              {loading ? 'Generating...' : 'Generate Invoice'}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print Preview
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

