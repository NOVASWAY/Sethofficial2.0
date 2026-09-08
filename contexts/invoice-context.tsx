'use client'

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react'
import { invoiceAPI } from '../lib/api-client'

export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  category: 'service' | 'medication' | 'lab-test' | 'procedure'
  diagnosis_code?: string
  diagnosis_description?: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  patientId: string
  patientName: string
  patientNumber?: string
  date: string
  dueDate?: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  amountPaid: number
  balance: number
  paymentMethod: 'cash' | 'mpesa' | 'sha' | 'nhif' | 'mixed' | 'pending'
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue'
  invoiceType: 'cash' | 'sha' | 'nhif' | 'mixed'
  notes?: string
  shaClaimNumber?: string
  mpesaTransactionCode?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  consultationId?: string
  prescriptionId?: string
}

export interface Payment {
  id: string
  invoiceId: string
  invoiceNumber: string
  amount: number
  method: 'cash' | 'mpesa' | 'sha' | 'nhif' | 'bank-transfer'
  reference?: string
  transactionCode?: string
  date: string
  receivedBy: string
  notes?: string
  createdAt: string
}

interface InvoiceContextType {
  invoices: Invoice[]
  payments: Payment[]
  addInvoice: (invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>) => Promise<Invoice>
  updateInvoice: (id: string, updates: Partial<Invoice>) => void
  getInvoiceById: (id: string) => Invoice | undefined
  getInvoicesByPatient: (patientId: string) => Invoice[]
  getPendingInvoices: () => Invoice[]
  getOverdueInvoices: () => Invoice[]
  addPayment: (payment: Omit<Payment, 'id' | 'createdAt'>) => void
  getPaymentsByInvoice: (invoiceId: string) => Payment[]
  getTotalRevenue: (startDate?: string, endDate?: string) => number
  getRevenueByMethod: (method: string, startDate?: string, endDate?: string) => number
  getOutstandingBalance: () => number
}

const InvoiceContext = createContext<InvoiceContextType | undefined>(undefined)

// Removed localStorage keys - now using API calls

// No default mock data - system starts empty

export function InvoiceProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from API on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const invoicesData = await invoiceAPI.getAll()
        setInvoices(invoicesData.data || [])
        // Load payments from invoices
        const allPayments: Payment[] = []
        for (const inv of invoicesData.data || []) {
          if (inv.payments && inv.payments.length > 0) {
            for (const p of inv.payments) {
              allPayments.push({ ...p, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber })
            }
          }
        }
        setPayments(allPayments)
      } catch (error) {
        console.error('Error loading invoices from API:', error)
        setInvoices([])
        setPayments([])
      } finally {
        setIsInitialized(true)
      }
    }

    loadData()
  }, [])

  // Removed localStorage save effects - data is now persisted via API calls

  // Memoize all functions to prevent unnecessary re-renders
  const addInvoice = useCallback(async (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>): Promise<Invoice> => {
    try {
      const newInvoice = await invoiceAPI.create(invoiceData)
      setInvoices(prev => [newInvoice, ...prev])
      return newInvoice
    } catch (error) {
      console.error('Error creating invoice:', error)
      throw error
    }
  }, [])

  const updateInvoice = useCallback(async (id: string, updates: Partial<Invoice>) => {
    try {
      await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      setInvoices(prev =>
        prev.map(invoice =>
          invoice.id === id
            ? { ...invoice, ...updates, updatedAt: new Date().toISOString() }
            : invoice
        )
      )
    } catch (error) {
      console.error('Error updating invoice via API:', error)
    }
  }, [])

  const getInvoiceById = useCallback((id: string): Invoice | undefined => {
    return invoices.find(inv => inv.id === id)
  }, [invoices])

  const getInvoicesByPatient = useCallback((patientId: string): Invoice[] => {
    return invoices.filter(inv => inv.patientId === patientId)
  }, [invoices])

  const getPendingInvoices = useCallback((): Invoice[] => {
    return invoices.filter(inv => inv.paymentStatus === 'pending' || inv.paymentStatus === 'partial')
  }, [invoices])

  const getOverdueInvoices = useCallback((): Invoice[] => {
    const today = new Date()
    return invoices.filter(inv => {
      if (inv.paymentStatus === 'paid') return false
      if (!inv.dueDate) return false
      return new Date(inv.dueDate) < today
    })
  }, [invoices])

  const addPayment = useCallback(async (paymentData: Omit<Payment, 'id' | 'createdAt'>) => {
    try {
      // Persist payment to API
      await fetch(`/api/invoices/${paymentData.invoiceId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentData.amount,
          paymentMethod: paymentData.method,
          reference: paymentData.reference || paymentData.transactionCode,
          notes: paymentData.notes,
        }),
      })

      const newPayment: Payment = {
        ...paymentData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      setPayments(prev => [newPayment, ...prev])

      // Update invoice payment status locally
      const invoice = invoices.find(inv => inv.id === paymentData.invoiceId)
      if (invoice) {
        const totalPaid = invoice.amountPaid + paymentData.amount
        const newBalance = invoice.total - totalPaid
        setInvoices(prev =>
          prev.map(inv =>
            inv.id === invoice.id
              ? {
                  ...inv,
                  amountPaid: totalPaid,
                  balance: newBalance,
                  paymentStatus: newBalance <= 0 ? 'paid' : newBalance < inv.total ? 'partial' : 'pending',
                  updatedAt: new Date().toISOString(),
                }
              : inv
          )
        )
      }
    } catch (error) {
      console.error('Error adding payment via API:', error)
    }
  }, [invoices])

  const getPaymentsByInvoice = useCallback((invoiceId: string): Payment[] => {
    return payments.filter(pay => pay.invoiceId === invoiceId)
  }, [payments])

  const getTotalRevenue = useCallback((startDate?: string, endDate?: string): number => {
    let filtered = invoices.filter(inv => inv.paymentStatus === 'paid')

    if (startDate) {
      filtered = filtered.filter(inv => inv.date >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter(inv => inv.date <= endDate)
    }

    return filtered.reduce((sum, inv) => sum + inv.total, 0)
  }, [invoices])

  const getRevenueByMethod = useCallback((method: string, startDate?: string, endDate?: string): number => {
    let filtered = invoices.filter(
      inv => inv.paymentStatus === 'paid' && inv.paymentMethod === method
    )

    if (startDate) {
      filtered = filtered.filter(inv => inv.date >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter(inv => inv.date <= endDate)
    }

    return filtered.reduce((sum, inv) => sum + inv.total, 0)
  }, [invoices])

  const getOutstandingBalance = useCallback((): number => {
    return invoices
      .filter(inv => inv.paymentStatus !== 'paid')
      .reduce((sum, inv) => sum + inv.balance, 0)
  }, [invoices])

  // Memoize context value to prevent unnecessary re-renders
  const value: InvoiceContextType = useMemo(() => ({
    invoices,
    payments,
    addInvoice,
    updateInvoice,
    getInvoiceById,
    getInvoicesByPatient,
    getPendingInvoices,
    getOverdueInvoices,
    addPayment,
    getPaymentsByInvoice,
    getTotalRevenue,
    getRevenueByMethod,
    getOutstandingBalance,
  }), [
    invoices,
    payments,
    addInvoice,
    updateInvoice,
    getInvoiceById,
    getInvoicesByPatient,
    getPendingInvoices,
    getOverdueInvoices,
    addPayment,
    getPaymentsByInvoice,
    getTotalRevenue,
    getRevenueByMethod,
    getOutstandingBalance,
  ])

  return (
    <InvoiceContext.Provider value={value}>
      {children}
    </InvoiceContext.Provider>
  )
}

export function useInvoices() {
  const context = useContext(InvoiceContext)
  if (context === undefined) {
    throw new Error('useInvoices must be used within an InvoiceProvider')
  }
  return context
}

