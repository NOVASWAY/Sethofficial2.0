import { useState, useCallback } from 'react'
import { mpesaApi, StkPushRequest, MpesaTransaction, MpesaTransactionStatus } from '@/lib/mpesa-api'
import { useToast } from '@/hooks/use-toast'

export interface UseMpesaReturn {
  // State
  isProcessing: boolean
  currentTransaction: MpesaTransaction | null
  transactionStatus: string
  
  // Actions
  initiatePayment: (request: StkPushRequest) => Promise<boolean>
  checkTransactionStatus: (checkoutRequestId: string) => Promise<MpesaTransactionStatus>
  pollTransactionStatus: (checkoutRequestId: string) => Promise<MpesaTransactionStatus>
  clearTransaction: () => void
  
  // Utilities
  validatePhoneNumber: (phone: string) => { isValid: boolean; formatted: string; error?: string }
  formatAmount: (amountInCents: number) => string
  getStatusColor: (status: string) => string
  getStatusIcon: (status: string) => string
}

export function useMpesa(): UseMpesaReturn {
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTransaction, setCurrentTransaction] = useState<MpesaTransaction | null>(null)
  const [transactionStatus, setTransactionStatus] = useState<string>('idle')
  const { toast } = useToast()

  const initiatePayment = useCallback(async (request: StkPushRequest): Promise<boolean> => {
    setIsProcessing(true)
    setTransactionStatus('initiating')
    
    try {
      // Validate phone number
      const phoneValidation = mpesaApi.validatePhoneNumber(request.phone_number)
      if (!phoneValidation.isValid) {
        toast({
          title: "Invalid Phone Number",
          description: phoneValidation.error || "Please enter a valid phone number",
          variant: "destructive",
        })
        return false
      }

      // Update request with formatted phone number
      const validatedRequest = {
        ...request,
        phone_number: phoneValidation.formatted
      }

      toast({
        title: "Initiating Payment",
        description: `Sending payment request to ${phoneValidation.formatted}`,
      })

      const response = await mpesaApi.initiateStkPush(validatedRequest)
      
      if (response.success && response.data) {
        setTransactionStatus('pending')
        toast({
          title: "Payment Request Sent",
          description: response.data.customer_message || "Check your phone to complete the payment",
        })
        return true
      } else {
        toast({
          title: "Payment Failed",
          description: response.error || "Failed to initiate payment. Please try again.",
          variant: "destructive",
        })
        return false
      }
    } catch (error) {
      console.error('Payment initiation error:', error)
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
      return false
    } finally {
      setIsProcessing(false)
    }
  }, [toast])

  const checkTransactionStatus = useCallback(async (checkoutRequestId: string): Promise<MpesaTransactionStatus> => {
    try {
      const result = await mpesaApi.getTransactionStatus(checkoutRequestId)
      
      if (result.success && result.data) {
        setCurrentTransaction(result.data)
        setTransactionStatus(result.data.status.toLowerCase())
        
        // Show status-specific toast
        switch (result.data.status) {
          case 'Completed':
            toast({
              title: "Payment Successful",
              description: `Payment of ${mpesaApi.formatAmount(result.data.amount)} completed successfully`,
            })
            break
          case 'Failed':
            toast({
              title: "Payment Failed",
              description: result.data.result_desc || "Payment was not completed",
              variant: "destructive",
            })
            break
          case 'Cancelled':
            toast({
              title: "Payment Cancelled",
              description: "Payment was cancelled by the user",
              variant: "destructive",
            })
            break
        }
      }
      
      return result
    } catch (error) {
      console.error('Status check error:', error)
      return {
        success: false,
        error: 'Failed to check transaction status'
      }
    }
  }, [toast])

  const pollTransactionStatus = useCallback(async (checkoutRequestId: string): Promise<MpesaTransactionStatus> => {
    setTransactionStatus('polling')
    
    try {
      const result = await mpesaApi.pollTransactionStatus(checkoutRequestId)
      
      if (result.success && result.data) {
        setCurrentTransaction(result.data)
        setTransactionStatus(result.data.status.toLowerCase())
        
        // Show final status toast
        switch (result.data.status) {
          case 'Completed':
            toast({
              title: "Payment Completed",
              description: `Payment of ${mpesaApi.formatAmount(result.data.amount)} completed successfully`,
            })
            break
          case 'Failed':
            toast({
              title: "Payment Failed",
              description: result.data.result_desc || "Payment was not completed",
              variant: "destructive",
            })
            break
          case 'Cancelled':
            toast({
              title: "Payment Cancelled",
              description: "Payment was cancelled by the user",
              variant: "destructive",
            })
            break
        }
      } else {
        setTransactionStatus('timeout')
        toast({
          title: "Payment Timeout",
          description: "Payment status check timed out. Please check manually.",
          variant: "destructive",
        })
      }
      
      return result
    } catch (error) {
      console.error('Status polling error:', error)
      setTransactionStatus('error')
      return {
        success: false,
        error: 'Failed to poll transaction status'
      }
    }
  }, [toast])

  const clearTransaction = useCallback(() => {
    setCurrentTransaction(null)
    setTransactionStatus('idle')
    setIsProcessing(false)
  }, [])

  const validatePhoneNumber = useCallback((phone: string) => {
    return mpesaApi.validatePhoneNumber(phone)
  }, [])

  const formatAmount = useCallback((amountInCents: number) => {
    return mpesaApi.formatAmount(amountInCents)
  }, [])

  const getStatusColor = useCallback((status: string) => {
    return mpesaApi.getStatusColor(status)
  }, [])

  const getStatusIcon = useCallback((status: string) => {
    return mpesaApi.getStatusIcon(status)
  }, [])

  return {
    // State
    isProcessing,
    currentTransaction,
    transactionStatus,
    
    // Actions
    initiatePayment,
    checkTransactionStatus,
    pollTransactionStatus,
    clearTransaction,
    
    // Utilities
    validatePhoneNumber,
    formatAmount,
    getStatusColor,
    getStatusIcon,
  }
}
