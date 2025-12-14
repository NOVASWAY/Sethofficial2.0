'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  CreditCard,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  AlertCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PaymentGatewayIntegrationProps {
  amount: number
  currency?: string
  invoiceId?: string
  patientId?: string
  patientName?: string
  onSuccess: (paymentData: PaymentResult) => void
  onError?: (error: string) => void
  onCancel?: () => void
}

interface PaymentResult {
  paymentId: string
  transactionId: string
  amount: number
  currency: string
  paymentMethod: 'card' | 'bank_transfer'
  gateway: string
  cardDetails?: {
    last4: string
    brand: string
    expiryMonth?: number
    expiryYear?: number
  }
  metadata?: Record<string, any>
}

type PaymentGateway = 'stripe' | 'pesapal' | 'paypal' | 'none'

export function PaymentGatewayIntegration({
  amount,
  currency = 'KES',
  invoiceId,
  patientId,
  patientName,
  onSuccess,
  onError,
  onCancel
}: PaymentGatewayIntegrationProps) {
  const { toast } = useToast()
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>('none')
  const [isProcessing, setIsProcessing] = useState(false)
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiryMonth: '',
    expiryYear: '',
    cvv: '',
    name: patientName || '',
    zipCode: ''
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [gatewayEnabled, setGatewayEnabled] = useState(false)

  // Check if payment gateway is enabled
  useEffect(() => {
    // TODO: Check backend for enabled payment gateways
    // For now, we'll assume it's configurable via environment
    const checkGatewayStatus = async () => {
      try {
        // const response = await paymentGatewayAPI.getSettings()
        // setGatewayEnabled(response.isEnabled)
        // For demo purposes, set to true
        setGatewayEnabled(true)
      } catch (error) {
        console.error('Failed to check gateway status:', error)
        setGatewayEnabled(false)
      }
    }
    checkGatewayStatus()
  }, [])

  const validateCardDetails = (): boolean => {
    const newErrors: Record<string, string> = {}

    // Validate card number (basic Luhn check)
    const cardNumber = cardDetails.number.replace(/\s/g, '')
    if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
      newErrors.number = 'Invalid card number'
    }

    // Validate expiry
    const month = parseInt(cardDetails.expiryMonth)
    const year = parseInt(cardDetails.expiryYear)
    if (!month || month < 1 || month > 12) {
      newErrors.expiryMonth = 'Invalid month'
    }
    if (!year || year < new Date().getFullYear()) {
      newErrors.expiryYear = 'Invalid year'
    }

    // Validate CVV
    if (!cardDetails.cvv || cardDetails.cvv.length < 3 || cardDetails.cvv.length > 4) {
      newErrors.cvv = 'Invalid CVV'
    }

    // Validate cardholder name
    if (!cardDetails.name || cardDetails.name.trim().length < 2) {
      newErrors.name = 'Cardholder name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const formatCardNumber = (value: string) => {
    // Remove all non-digits
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    // Add spaces every 4 digits
    const matches = v.match(/\d{4,16}/g)
    const match = matches && matches[0] || ''
    const parts = []
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    if (parts.length) {
      return parts.join(' ')
    } else {
      return v
    }
  }

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value)
    setCardDetails({ ...cardDetails, number: formatted })
  }

  const detectCardBrand = (number: string): string => {
    const num = number.replace(/\s/g, '')
    if (/^4/.test(num)) return 'visa'
    if (/^5[1-5]/.test(num)) return 'mastercard'
    if (/^3[47]/.test(num)) return 'amex'
    if (/^6(?:011|5)/.test(num)) return 'discover'
    return 'unknown'
  }

  const handlePayment = async () => {
    if (!validateCardDetails()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please check your card details and try again',
      })
      return
    }

    if (selectedGateway === 'none') {
      toast({
        variant: 'destructive',
        title: 'No Gateway Selected',
        description: 'Please select a payment gateway',
      })
      return
    }

    setIsProcessing(true)

    try {
      // TODO: Integrate with actual payment gateway API
      // This is a mock implementation - replace with real API calls

      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Mock successful payment
      const cardNumber = cardDetails.number.replace(/\s/g, '')
      const last4 = cardNumber.slice(-4)
      const brand = detectCardBrand(cardNumber)

      const paymentResult: PaymentResult = {
        paymentId: `pay_${Date.now()}`,
        transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        amount,
        currency,
        paymentMethod: 'card',
        gateway: selectedGateway,
        cardDetails: {
          last4,
          brand,
          expiryMonth: parseInt(cardDetails.expiryMonth),
          expiryYear: parseInt(cardDetails.expiryYear),
        },
        metadata: {
          invoiceId,
          patientId,
          patientName,
        }
      }

      onSuccess(paymentResult)

      toast({
        title: 'Payment Successful',
        description: `Payment of ${currency} ${amount.toLocaleString()} processed successfully`,
      })

    } catch (error: any) {
      const errorMessage = error.message || 'Payment processing failed. Please try again.'
      onError?.(errorMessage)
      toast({
        variant: 'destructive',
        title: 'Payment Failed',
        description: errorMessage,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  if (!gatewayEnabled) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Payment gateway is not currently enabled. Please contact your administrator or use an alternative payment method.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <CreditCard className="h-5 w-5" />
          <CardTitle>Card Payment</CardTitle>
        </div>
        <CardDescription>
          Pay securely with your credit or debit card
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gateway Selection */}
        <div className="space-y-2">
          <Label>Payment Gateway</Label>
          <Select
            value={selectedGateway}
            onValueChange={(value) => setSelectedGateway(value as PaymentGateway)}
            disabled={isProcessing}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select payment gateway" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="pesapal">Pesapal</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
              <SelectItem value="none" disabled>None (Select a gateway)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedGateway !== 'none' && (
          <>
            {/* Amount Display */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="text-2xl font-bold">{currency} {amount.toLocaleString()}</span>
              </div>
            </div>

            {/* Card Details Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="card-number">Card Number</Label>
                <Input
                  id="card-number"
                  type="text"
                  placeholder="1234 5678 9012 3456"
                  value={cardDetails.number}
                  onChange={handleCardNumberChange}
                  maxLength={19}
                  disabled={isProcessing}
                  className={errors.number ? 'border-red-500' : ''}
                />
                {errors.number && (
                  <p className="text-sm text-red-500">{errors.number}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry-month">Expiry Month</Label>
                  <Input
                    id="expiry-month"
                    type="text"
                    placeholder="MM"
                    value={cardDetails.expiryMonth}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                      setCardDetails({ ...cardDetails, expiryMonth: val })
                    }}
                    maxLength={2}
                    disabled={isProcessing}
                    className={errors.expiryMonth ? 'border-red-500' : ''}
                  />
                  {errors.expiryMonth && (
                    <p className="text-sm text-red-500">{errors.expiryMonth}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiry-year">Expiry Year</Label>
                  <Input
                    id="expiry-year"
                    type="text"
                    placeholder="YYYY"
                    value={cardDetails.expiryYear}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                      setCardDetails({ ...cardDetails, expiryYear: val })
                    }}
                    maxLength={4}
                    disabled={isProcessing}
                    className={errors.expiryYear ? 'border-red-500' : ''}
                  />
                  {errors.expiryYear && (
                    <p className="text-sm text-red-500">{errors.expiryYear}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    type="text"
                    placeholder="123"
                    value={cardDetails.cvv}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4)
                      setCardDetails({ ...cardDetails, cvv: val })
                    }}
                    maxLength={4}
                    disabled={isProcessing}
                    className={errors.cvv ? 'border-red-500' : ''}
                  />
                  {errors.cvv && (
                    <p className="text-sm text-red-500">{errors.cvv}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip-code">ZIP Code</Label>
                  <Input
                    id="zip-code"
                    type="text"
                    placeholder="00100"
                    value={cardDetails.zipCode}
                    onChange={(e) => setCardDetails({ ...cardDetails, zipCode: e.target.value })}
                    disabled={isProcessing}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-name">Cardholder Name</Label>
                <Input
                  id="card-name"
                  type="text"
                  placeholder="John Doe"
                  value={cardDetails.name}
                  onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                  disabled={isProcessing}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name}</p>
                )}
              </div>
            </div>

            {/* Security Notice */}
            <div className="flex items-start space-x-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-200">
                Your payment information is encrypted and secure. We never store your full card details.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-2 pt-4">
              {onCancel && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handlePayment}
                disabled={isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay {currency} {amount.toLocaleString()}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

