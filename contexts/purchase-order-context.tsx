'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface PurchaseOrderItem {
  id: string
  medicineId: string
  medicineName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  supplier: string
  batchNumber?: string
  expiryDate?: string
  notes?: string
}

export interface PurchaseOrder {
  id: string
  orderNumber: string
  supplier: string
  supplierContact: string
  orderDate: string
  expectedDelivery: string
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled'
  items: PurchaseOrderItem[]
  subtotal: number
  tax: number
  total: number
  notes?: string
  createdBy: string
  approvedBy?: string
  receivedBy?: string
  createdAt: string
  updatedAt: string
}

export interface Supplier {
  id: string
  name: string
  contactPerson: string
  email?: string
  phone: string
  address: string
  paymentTerms: string
  isActive: boolean
  createdAt: string
}

interface PurchaseOrderContextType {
  // Purchase Orders
  purchaseOrders: PurchaseOrder[]
  addPurchaseOrder: (order: Omit<PurchaseOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>) => PurchaseOrder
  updatePurchaseOrder: (id: string, updates: Partial<PurchaseOrder>) => void
  deletePurchaseOrder: (id: string) => void
  getPurchaseOrderById: (id: string) => PurchaseOrder | undefined
  getPurchaseOrdersByStatus: (status: PurchaseOrder['status']) => PurchaseOrder[]
  
  // Order Management
  approveOrder: (id: string, approvedBy: string) => void
  markAsOrdered: (id: string) => void
  receiveOrder: (id: string, receivedBy: string) => void
  cancelOrder: (id: string, reason?: string) => void
  
  // Suppliers
  suppliers: Supplier[]
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => Supplier
  updateSupplier: (id: string, updates: Partial<Supplier>) => void
  deleteSupplier: (id: string) => void
  getSupplierById: (id: string) => Supplier | undefined
  getActiveSuppliers: () => Supplier[]
  
  // Analytics
  getTotalOrdersValue: () => number
  getOrdersByMonth: (year: number, month: number) => PurchaseOrder[]
  getTopSuppliers: (limit?: number) => Array<{ supplier: string; totalValue: number; orderCount: number }>
  getPendingOrdersCount: () => number
}

const PurchaseOrderContext = createContext<PurchaseOrderContextType | undefined>(undefined)

const PURCHASE_ORDERS_STORAGE_KEY = 'clinic_purchase_orders'
const SUPPLIERS_STORAGE_KEY = 'clinic_suppliers'

// Default suppliers
const defaultSuppliers: Supplier[] = [
  {
    id: 'SUP001',
    name: 'MediPharm Kenya Ltd',
    contactPerson: 'John Kamau',
    email: 'orders@medipharm.co.ke',
    phone: '+254 700 123 456',
    address: 'Industrial Area, Nairobi',
    paymentTerms: 'Net 30',
    isActive: true,
    createdAt: new Date('2024-01-01').toISOString(),
  },
  {
    id: 'SUP002',
    name: 'PharmaCare Distributors',
    contactPerson: 'Sarah Wanjiku',
    email: 'sales@pharmacare.co.ke',
    phone: '+254 700 234 567',
    address: 'Westlands, Nairobi',
    paymentTerms: 'Net 15',
    isActive: true,
    createdAt: new Date('2024-01-15').toISOString(),
  },
  {
    id: 'SUP003',
    name: 'Global Medical Supplies',
    contactPerson: 'Michael Ochieng',
    email: 'michael@gms.co.ke',
    phone: '+254 700 345 678',
    address: 'Mombasa Road, Nairobi',
    paymentTerms: 'COD',
    isActive: true,
    createdAt: new Date('2024-02-01').toISOString(),
  },
]

// Default purchase orders
const defaultPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO001',
    orderNumber: 'PO-2024-001',
    supplier: 'MediPharm Kenya Ltd',
    supplierContact: '+254 700 123 456',
    orderDate: new Date('2024-01-15').toISOString(),
    expectedDelivery: new Date('2024-01-22').toISOString(),
    status: 'received',
    items: [
      {
        id: 'POI001',
        medicineId: 'MED001',
        medicineName: 'Paracetamol 500mg',
        quantity: 1000,
        unitPrice: 2.50,
        totalPrice: 2500,
        supplier: 'MediPharm Kenya Ltd',
        batchNumber: 'BATCH001',
        expiryDate: '2025-12-31',
      },
      {
        id: 'POI002',
        medicineId: 'MED002',
        medicineName: 'Amoxicillin 250mg',
        quantity: 500,
        unitPrice: 15.00,
        totalPrice: 7500,
        supplier: 'MediPharm Kenya Ltd',
        batchNumber: 'BATCH002',
        expiryDate: '2025-11-30',
      },
    ],
    subtotal: 10000,
    tax: 1600,
    total: 11600,
    notes: 'Urgent order for restocking',
    createdBy: 'U001',
    approvedBy: 'U005',
    receivedBy: 'U003',
    createdAt: new Date('2024-01-15').toISOString(),
    updatedAt: new Date('2024-01-22').toISOString(),
  },
  {
    id: 'PO002',
    orderNumber: 'PO-2024-002',
    supplier: 'PharmaCare Distributors',
    supplierContact: '+254 700 234 567',
    orderDate: new Date('2024-01-20').toISOString(),
    expectedDelivery: new Date('2024-01-27').toISOString(),
    status: 'ordered',
    items: [
      {
        id: 'POI003',
        medicineId: 'MED003',
        medicineName: 'Ibuprofen 400mg',
        quantity: 800,
        unitPrice: 3.00,
        totalPrice: 2400,
        supplier: 'PharmaCare Distributors',
        batchNumber: 'BATCH003',
        expiryDate: '2025-10-31',
      },
    ],
    subtotal: 2400,
    tax: 384,
    total: 2784,
    createdBy: 'U001',
    approvedBy: 'U005',
    createdAt: new Date('2024-01-20').toISOString(),
    updatedAt: new Date('2024-01-20').toISOString(),
  },
]

export function PurchaseOrderProvider({ children }: { children: ReactNode }) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsInitialized(true)
      return
    }
    
    try {
      const savedOrders = localStorage.getItem(PURCHASE_ORDERS_STORAGE_KEY)
      const savedSuppliers = localStorage.getItem(SUPPLIERS_STORAGE_KEY)
      
      if (savedOrders) {
        setPurchaseOrders(JSON.parse(savedOrders))
      } else {
        setPurchaseOrders(defaultPurchaseOrders)
      }
      
      if (savedSuppliers) {
        setSuppliers(JSON.parse(savedSuppliers))
      } else {
        setSuppliers(defaultSuppliers)
      }
    } catch (error) {
      console.error('Error loading purchase order data from localStorage:', error)
      setPurchaseOrders(defaultPurchaseOrders)
      setSuppliers(defaultSuppliers)
    } finally {
      setIsInitialized(true)
    }
  }, [])

  // Save purchase orders to localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !isInitialized) return
    
    try {
      localStorage.setItem(PURCHASE_ORDERS_STORAGE_KEY, JSON.stringify(purchaseOrders))
    } catch (error) {
      console.error('Error saving purchase orders to localStorage:', error)
    }
  }, [purchaseOrders, isInitialized])

  // Save suppliers to localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !isInitialized) return
    
    try {
      localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(suppliers))
    } catch (error) {
      console.error('Error saving suppliers to localStorage:', error)
    }
  }, [suppliers, isInitialized])

  // Generate order number
  const generateOrderNumber = (): string => {
    const year = new Date().getFullYear()
    const existingOrders = purchaseOrders.filter(po => po.orderNumber.startsWith(`PO-${year}-`))
    const nextNumber = existingOrders.length + 1
    return `PO-${year}-${String(nextNumber).padStart(3, '0')}`
  }

  // Purchase Order CRUD
  const addPurchaseOrder = (orderData: Omit<PurchaseOrder, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): PurchaseOrder => {
    const now = new Date().toISOString()
    const newOrder: PurchaseOrder = {
      ...orderData,
      id: `PO${String(Date.now()).slice(-6)}`,
      orderNumber: generateOrderNumber(),
      createdAt: now,
      updatedAt: now,
    }

    setPurchaseOrders(prev => [...prev, newOrder])
    return newOrder
  }

  const updatePurchaseOrder = (id: string, updates: Partial<PurchaseOrder>) => {
    setPurchaseOrders(prev =>
      prev.map(order =>
        order.id === id
          ? { ...order, ...updates, updatedAt: new Date().toISOString() }
          : order
      )
    )
  }

  const deletePurchaseOrder = (id: string) => {
    setPurchaseOrders(prev => prev.filter(order => order.id !== id))
  }

  const getPurchaseOrderById = (id: string): PurchaseOrder | undefined => {
    return purchaseOrders.find(order => order.id === id)
  }

  const getPurchaseOrdersByStatus = (status: PurchaseOrder['status']): PurchaseOrder[] => {
    return purchaseOrders.filter(order => order.status === status)
  }

  // Order Management
  const approveOrder = (id: string, approvedBy: string) => {
    updatePurchaseOrder(id, { status: 'approved', approvedBy })
  }

  const markAsOrdered = (id: string) => {
    updatePurchaseOrder(id, { status: 'ordered' })
  }

  const receiveOrder = (id: string, receivedBy: string) => {
    updatePurchaseOrder(id, { status: 'received', receivedBy })
  }

  const cancelOrder = (id: string, reason?: string) => {
    updatePurchaseOrder(id, { 
      status: 'cancelled',
      notes: reason ? `${reason} (Cancelled)` : 'Order cancelled'
    })
  }

  // Supplier CRUD
  const addSupplier = (supplierData: Omit<Supplier, 'id' | 'createdAt'>): Supplier => {
    const now = new Date().toISOString()
    const newSupplier: Supplier = {
      ...supplierData,
      id: `SUP${String(Date.now()).slice(-6)}`,
      createdAt: now,
    }

    setSuppliers(prev => [...prev, newSupplier])
    return newSupplier
  }

  const updateSupplier = (id: string, updates: Partial<Supplier>) => {
    setSuppliers(prev =>
      prev.map(supplier =>
        supplier.id === id ? { ...supplier, ...updates } : supplier
      )
    )
  }

  const deleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(supplier => supplier.id !== id))
  }

  const getSupplierById = (id: string): Supplier | undefined => {
    return suppliers.find(supplier => supplier.id === id)
  }

  const getActiveSuppliers = (): Supplier[] => {
    return suppliers.filter(supplier => supplier.isActive)
  }

  // Analytics
  const getTotalOrdersValue = (): number => {
    return purchaseOrders.reduce((total, order) => total + order.total, 0)
  }

  const getOrdersByMonth = (year: number, month: number): PurchaseOrder[] => {
    return purchaseOrders.filter(order => {
      const orderDate = new Date(order.orderDate)
      return orderDate.getFullYear() === year && orderDate.getMonth() === month - 1
    })
  }

  const getTopSuppliers = (limit: number = 5): Array<{ supplier: string; totalValue: number; orderCount: number }> => {
    const supplierStats = new Map<string, { totalValue: number; orderCount: number }>()
    
    purchaseOrders.forEach(order => {
      const existing = supplierStats.get(order.supplier) || { totalValue: 0, orderCount: 0 }
      supplierStats.set(order.supplier, {
        totalValue: existing.totalValue + order.total,
        orderCount: existing.orderCount + 1,
      })
    })

    return Array.from(supplierStats.entries())
      .map(([supplier, stats]) => ({ supplier, ...stats }))
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, limit)
  }

  const getPendingOrdersCount = (): number => {
    return purchaseOrders.filter(order => 
      ['draft', 'pending', 'approved', 'ordered'].includes(order.status)
    ).length
  }

  const value: PurchaseOrderContextType = {
    purchaseOrders,
    addPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    getPurchaseOrderById,
    getPurchaseOrdersByStatus,
    approveOrder,
    markAsOrdered,
    receiveOrder,
    cancelOrder,
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    getSupplierById,
    getActiveSuppliers,
    getTotalOrdersValue,
    getOrdersByMonth,
    getTopSuppliers,
    getPendingOrdersCount,
  }

  return (
    <PurchaseOrderContext.Provider value={value}>
      {children}
    </PurchaseOrderContext.Provider>
  )
}

export function usePurchaseOrders() {
  const context = useContext(PurchaseOrderContext)
  if (context === undefined) {
    throw new Error('usePurchaseOrders must be used within a PurchaseOrderProvider')
  }
  return context
}
