'use client'

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { consultationAPI, invoiceAPI, mpesaAPI, APIError } from '@/lib/api-client'

interface Prescription {
  medication_id: string
  medication_name: string
  dosage: string
  frequency: string
  duration_days: number
  quantity: number
  instructions: string
}

interface ServiceItem {
  id: string
  service_code: string
  service_name: string
  unit_price: number
  category: string
}

interface ConsultationData {
  consultation_id?: string
  consultation_number?: string
  patient_id: string
  patient_name: string
  clinician_name: string
  date: string
  time: string
  chief_complaint: string
  diagnosis?: string
  icd_code?: string
  prescriptions: Prescription[]
  services: ServiceItem[]
  notes?: string
  insurance_type?: 'cash' | 'sha' | 'mixed'
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
}

interface InvoiceData {
  invoice_id?: string
  invoice_number?: string
  patient_id: string
  patient_name: string
  date: string
  items: Array<{
    item_type: 'service' | 'medicine'
    item_id?: string
    item_name: string
    quantity: number
    unit_price: number
    total_price: number
  }>
  subtotal: number
  tax_amount: number
  total_amount: number
  payment_status: 'pending' | 'paid' | 'partial' | 'cancelled'
  payment_method?: 'cash' | 'mpesa' | 'card' | 'insurance'
  insurance_type?: 'cash' | 'sha' | 'mixed'
}

interface WorkflowContextType {
  // Consultation state
  pendingConsultation: ConsultationData | null
  setPendingConsultation: (data: ConsultationData | null) => void
  
  // Prescription state
  pendingPrescriptions: Prescription[]
  addPrescriptionToQueue: (patientId: string, patientName: string, prescription: Prescription) => void
  clearPrescriptionQueue: () => void
  
  // Invoice state
  pendingInvoice: InvoiceData | null
  setPendingInvoice: (data: InvoiceData | null) => void
  
  // API operations
  saveConsultation: (consultationData: ConsultationData) => Promise<{ success: boolean; data?: any; error?: string }>
  createInvoice: (invoiceData: InvoiceData) => Promise<{ success: boolean; data?: any; error?: string }>
  processPayment: (invoiceId: string, paymentData: any) => Promise<{ success: boolean; data?: any; error?: string }>
  initiateMpesaPayment: (invoiceId: string, phoneNumber: string, amount: number) => Promise<{ success: boolean; data?: any; error?: string }>
  
  // Loading states
  isLoading: boolean
  error: string | null
  clearError: () => void
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined)

export function WorkflowProviderEnhanced({ children }: { children: ReactNode }) {
  const [pendingConsultation, setPendingConsultation] = useState<ConsultationData | null>(null)
  const [pendingPrescriptions, setPendingPrescriptions] = useState<Prescription[]>([])
  const [pendingInvoice, setPendingInvoice] = useState<InvoiceData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addPrescriptionToQueue = useCallback((patientId: string, patientName: string, prescription: Prescription) => {
    setPendingPrescriptions(prev => [...prev, prescription])
  }, [])

  const clearPrescriptionQueue = useCallback(() => {
    setPendingPrescriptions([])
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const saveConsultation = useCallback(async (consultationData: ConsultationData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Transform the consultation data to match backend format
      const backendData = {
        patient_id: consultationData.patient_id,
        date: consultationData.date,
        time: consultationData.time,
        chief_complaint: consultationData.chief_complaint,
        diagnosis: consultationData.diagnosis,
        treatment_plan: consultationData.notes,
        notes: consultationData.notes,
      }

      const result = await consultationAPI.create(backendData)
      
      // Update the consultation with the returned ID
      const updatedConsultation = {
        ...consultationData,
        consultation_id: result.id,
        consultation_number: result.consultation_number || `CONS-${Date.now()}`,
        status: 'completed' as const,
      }
      
      setPendingConsultation(updatedConsultation)
      
      return { success: true, data: result }
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to save consultation'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createInvoice = useCallback(async (invoiceData: InvoiceData) => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Transform the invoice data to match backend format
      const backendData = {
        patient_id: invoiceData.patient_id,
        date: invoiceData.date,
        items: invoiceData.items,
        subtotal: invoiceData.subtotal,
        tax_amount: invoiceData.tax_amount,
        total_amount: invoiceData.total_amount,
        payment_method: invoiceData.payment_method,
      }

      const result = await invoiceAPI.create(backendData)
      
      // Update the invoice with the returned data
      const updatedInvoice = {
        ...invoiceData,
        invoice_id: result.id,
        invoice_number: result.invoice_number,
        payment_status: 'pending' as const,
      }
      
      setPendingInvoice(updatedInvoice)
      
      return { success: true, data: result }
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to create invoice'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const processPayment = useCallback(async (invoiceId: string, paymentData: any) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await invoiceAPI.processPayment(invoiceId, paymentData)
      
      // Update pending invoice if it matches
      if (pendingInvoice?.invoice_id === invoiceId) {
        setPendingInvoice(prev => prev ? {
          ...prev,
          payment_status: 'paid' as const,
          payment_method: paymentData.payment_method,
        } : null)
      }
      
      return { success: true, data: result }
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to process payment'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [pendingInvoice])

  const initiateMpesaPayment = useCallback(async (invoiceId: string, phoneNumber: string, amount: number) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const stkData = {
        invoice_id: invoiceId,
        phone_number: phoneNumber,
        amount: amount,
      }

      const result = await mpesaAPI.initiateStkPush(stkData)
      
      return { success: true, data: result }
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to initiate M-Pesa payment'
      setError(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const value: WorkflowContextType = {
    // State
    pendingConsultation,
    setPendingConsultation,
    pendingPrescriptions,
    pendingInvoice,
    setPendingInvoice,
    isLoading,
    error,
    
    // Actions
    addPrescriptionToQueue,
    clearPrescriptionQueue,
    clearError,
    
    // API operations
    saveConsultation,
    createInvoice,
    processPayment,
    initiateMpesaPayment,
  }

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  )
}

export function useWorkflowEnhanced() {
  const context = useContext(WorkflowContext)
  if (context === undefined) {
    throw new Error('useWorkflowEnhanced must be used within a WorkflowProviderEnhanced')
  }
  return context
}

// Legacy export for backward compatibility
export const useWorkflow = useWorkflowEnhanced
export const WorkflowProvider = WorkflowProviderEnhanced
