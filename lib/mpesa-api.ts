// M-Pesa API client for Daraja integration
import { apiClient } from './api-client'

export interface StkPushRequest {
  phone_number: string
  amount: number
  account_reference: string
  transaction_desc: string
  invoice_id: string
}

export interface StkPushResponse {
  success: boolean
  message: string
  data?: {
    merchant_request_id: string
    checkout_request_id: string
    response_code: string
    response_description: string
    customer_message: string
  }
  error?: string
}

export interface MpesaTransaction {
  id: string
  invoice_id: string
  merchant_request_id: string
  checkout_request_id: string
  phone_number: string
  amount: number
  account_reference: string
  transaction_desc: string
  status: 'Pending' | 'Completed' | 'Failed' | 'Cancelled'
  result_code?: number
  result_desc?: string
  mpesa_receipt_number?: string
  transaction_date?: string
  created_at: string
  updated_at: string
}

export interface MpesaTransactionStatus {
  success: boolean
  data?: MpesaTransaction
  error?: string
}

export interface MpesaTransactionsResponse {
  success: boolean
  data: MpesaTransaction[]
  count: number
}

class MpesaApiClient {
  private baseUrl = '/api/v1/mpesa'

  /**
   * Initiate STK Push payment
   */
  async initiateStkPush(request: StkPushRequest): Promise<StkPushResponse> {
    try {
      const response = await apiClient.post<StkPushResponse>(`${this.baseUrl}/stk-push`, request)
      return response
    } catch (error: any) {
      console.error('STK Push initiation failed:', error)
      return {
        success: false,
        message: 'Failed to initiate payment',
        error: error.response?.data?.error || error.message || 'Unknown error'
      }
    }
  }

  /**
   * Get M-Pesa transaction status by checkout request ID
   */
  async getTransactionStatus(checkoutRequestId: string): Promise<MpesaTransactionStatus> {
    try {
      const response = await apiClient.get<MpesaTransaction>(`${this.baseUrl}/transaction/${checkoutRequestId}`)
      return {
        success: true,
        data: response
      }
    } catch (error: any) {
      console.error('Failed to get transaction status:', error)
      return {
        success: false,
        error: error.response?.data?.error || error.message || 'Unknown error'
      }
    }
  }

  /**
   * Get all M-Pesa transactions for an invoice
   */
  async getInvoiceTransactions(invoiceId: string): Promise<MpesaTransactionsResponse> {
    try {
      const response = await apiClient.get<MpesaTransactionsResponse>(`${this.baseUrl}/invoice/${invoiceId}/transactions`)
      return response
    } catch (error: any) {
      console.error('Failed to get invoice transactions:', error)
      return {
        success: false,
        data: [],
        count: 0
      }
    }
  }

  /**
   * Poll transaction status until completion or timeout
   */
  async pollTransactionStatus(
    checkoutRequestId: string,
    maxAttempts: number = 30,
    intervalMs: number = 2000
  ): Promise<MpesaTransactionStatus> {
    let attempts = 0

    while (attempts < maxAttempts) {
      const result = await this.getTransactionStatus(checkoutRequestId)

      if (result.success && result.data) {
        // Check if transaction is completed (success or failure)
        if (result.data.status === 'Completed' || result.data.status === 'Failed' || result.data.status === 'Cancelled') {
          return result
        }
      }

      attempts++
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs))
      }
    }

    return {
      success: false,
      error: 'Transaction status polling timed out'
    }
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): { isValid: boolean; formatted: string; error?: string } {
    // Remove any spaces, dashes, or parentheses
    const cleaned = phone.replace(/[\s\-\(\)]/g, '')

    // Check if it starts with +254
    if (cleaned.startsWith('+254') && cleaned.length === 13) {
      return { isValid: true, formatted: cleaned }
    }

    // Check if it starts with 254
    if (cleaned.startsWith('254') && cleaned.length === 12) {
      return { isValid: true, formatted: `+${cleaned}` }
    }

    // Check if it starts with 0
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return { isValid: true, formatted: `+254${cleaned.slice(1)}` }
    }

    // Check if it's 9 digits (assume it's missing country code)
    if (cleaned.length === 9 && /^\d+$/.test(cleaned)) {
      return { isValid: true, formatted: `+254${cleaned}` }
    }

    return {
      isValid: false,
      formatted: phone,
      error: 'Invalid phone number format. Use format: +254XXXXXXXXX'
    }
  }

  /**
   * Format amount for display (convert from cents to KES)
   */
  formatAmount(amountInCents: number): string {
    return `KES ${(amountInCents / 100).toFixed(2)}`
  }

  /**
   * Get status color for UI display
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'Completed':
        return 'text-green-600 bg-green-100'
      case 'Failed':
        return 'text-red-600 bg-red-100'
      case 'Cancelled':
        return 'text-gray-600 bg-gray-100'
      case 'Pending':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  /**
   * Get status icon for UI display
   */
  getStatusIcon(status: string): string {
    switch (status) {
      case 'Completed':
        return '✅'
      case 'Failed':
        return '❌'
      case 'Cancelled':
        return '🚫'
      case 'Pending':
        return '⏳'
      default:
        return '❓'
    }
  }
}

export const mpesaApi = new MpesaApiClient()
