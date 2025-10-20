'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { invoiceAPI } from '../lib/api-client'

export interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  category: 'service' | 'medication' | 'lab-test' | 'procedure'
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
  paymentMethod: 'cash' | 'mpesa' | 'sha' | 'mixed' | 'pending'
  paymentStatus: 'pending' | 'partial' | 'paid' | 'overdue'
  invoiceType: 'cash' | 'sha' | 'mixed'
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
  method: 'cash' | 'mpesa' | 'sha' | 'bank-transfer'
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

// Generate invoice number
const generateInvoiceNumber = (): string => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return `INV-${year}${month}${day}-${random}`
}

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
        // TODO: Load payments from API when endpoint is available
        setPayments([])
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

  const addInvoice = async (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'updatedAt'>): Promise<Invoice> => {
    try {
      const newInvoice = await invoiceAPI.create(invoiceData)
      setInvoices(prev => [newInvoice, ...prev])
      return newInvoice
    } catch (error) {
      console.error('Error creating invoice:', error)
      throw error
    }
  }

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    setInvoices(prev =>
      prev.map(invoice =>
        invoice.id === id
          ? { ...invoice, ...updates, updatedAt: new Date().toISOString() }
          : invoice
      )
    )
  }

  const getInvoiceById = (id: string): Invoice | undefined => {
    return invoices.find(inv => inv.id === id)
  }

  const getInvoicesByPatient = (patientId: string): Invoice[] => {
    return invoices.filter(inv => inv.patientId === patientId)
  }

  const getPendingInvoices = (): Invoice[] => {
    return invoices.filter(inv => inv.paymentStatus === 'pending' || inv.paymentStatus === 'partial')
  }

  const getOverdueInvoices = (): Invoice[] => {
    const today = new Date()
    return invoices.filter(inv => {
      if (inv.paymentStatus === 'paid') return false
      if (!inv.dueDate) return false
      return new Date(inv.dueDate) < today
    })
  }

  const addPayment = (paymentData: Omit<Payment, 'id' | 'createdAt'>) => {
    const newPayment: Payment = {
      ...paymentData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }

    setPayments(prev => [newPayment, ...prev])

    // Update invoice payment status
    const invoice = invoices.find(inv => inv.id === paymentData.invoiceId)
    if (invoice) {
      const totalPaid = invoice.amountPaid + paymentData.amount
      const newBalance = invoice.total - totalPaid
      
      updateInvoice(invoice.id, {
        amountPaid: totalPaid,
        balance: newBalance,
        paymentStatus: newBalance <= 0 ? 'paid' : newBalance < invoice.total ? 'partial' : 'pending',
      })
    }
  }

  const getPaymentsByInvoice = (invoiceId: string): Payment[] => {
    return payments.filter(pay => pay.invoiceId === invoiceId)
  }

  const getTotalRevenue = (startDate?: string, endDate?: string): number => {
    let filtered = invoices.filter(inv => inv.paymentStatus === 'paid')
    
    if (startDate) {
      filtered = filtered.filter(inv => inv.date >= startDate)
    }
    if (endDate) {
      filtered = filtered.filter(inv => inv.date <= endDate)
    }

    return filtered.reduce((sum, inv) => sum + inv.total, 0)
  }

  const getRevenueByMethod = (method: string, startDate?: string, endDate?: string): number => {
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
  }

  const getOutstandingBalance = (): number => {
    return invoices
      .filter(inv => inv.paymentStatus !== 'paid')
      .reduce((sum, inv) => sum + inv.balance, 0)
  }

  const value: InvoiceContextType = {
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
  }

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

