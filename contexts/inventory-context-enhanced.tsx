'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { pharmacyAPI, APIError } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

// Medicine interface matching backend
export interface Medicine {
  id: string
  name: string
  generic_name: string
  dosage_form: string
  strength: string
  manufacturer: string
  batch_number?: string
  expiry_date?: string
  current_stock: number
  minimum_stock: number
  unit_price: string // BigDecimal from backend as string
  created_at: string
  updated_at: string
}

// Stock movement interface matching backend
export interface StockMovement {
  id: string
  medicine_id: string
  movement_type: 'in' | 'out' | 'adjustment' | 'expired' | 'damaged'
  quantity: number
  batch_number?: string
  expiry_date?: string
  reference_type?: string
  reference_id?: string
  notes?: string
  created_by: string
  created_at: string
}

// Stock alert interface matching backend
export interface StockAlert {
  id: string
  medicine_id: string
  alert_type: 'low_stock' | 'expired' | 'expiring_soon'
  message: string
  is_resolved: boolean
  created_at: string
  resolved_at?: string
}

interface PaginatedResponse<T> {
  data: T[]
  page: number
  per_page: number
  total: number
  total_pages: number
}

interface InventoryContextType {
  // State
  medicines: Medicine[]
  stockMovements: StockMovement[]
  stockAlerts: StockAlert[]
  loading: boolean
  error: string | null
  
  // Medicine operations
  loadMedicines: (params?: { page?: number; per_page?: number; search?: string }) => Promise<void>
  getMedicine: (id: string) => Medicine | undefined
  addMedicine: (medicine: Omit<Medicine, 'id' | 'created_at' | 'updated_at'>) => Promise<Medicine>
  updateMedicine: (id: string, updates: Partial<Medicine>) => Promise<Medicine>
  
  // Stock operations
  loadStockMovements: (medicineId: string, params?: { page?: number; per_page?: number }) => Promise<void>
  receiveStock: (stockData: {
    medicine_id: string
    movement_type: string
    quantity: number
    batch_number?: string
    expiry_date?: string
    reference_type?: string
    reference_id?: string
    notes?: string
  }) => Promise<StockMovement>
  
  // Alerts
  loadStockAlerts: () => Promise<void>
  getLowStockMedicines: () => Medicine[]
  getExpiredMedicines: () => Medicine[]
  getExpiringMedicines: (days?: number) => Medicine[]
  
  // Utility functions
  checkStock: (medicineId: string, requiredQuantity: number) => boolean
  clearError: () => void
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

export function InventoryProviderEnhanced({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([])
  const [loading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const loadMedicines = useCallback(async (params?: { page?: number; per_page?: number; search?: string }) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await pharmacyAPI.getMedicines(params)
      setMedicines(response.data || [])
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to load medicines'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const getMedicine = useCallback((id: string): Medicine | undefined => {
    return medicines.find(medicine => medicine.id === id)
  }, [medicines])

  const addMedicine = useCallback(async (medicineData: Omit<Medicine, 'id' | 'created_at' | 'updated_at'>): Promise<Medicine> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await pharmacyAPI.addMedicine(medicineData)
      
      // Add the new medicine to the local state
      setMedicines(prev => [...prev, result])
      
      toast({
        title: 'Success',
        description: 'Medicine added successfully',
      })
      
      return result
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to add medicine'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const updateMedicine = useCallback(async (id: string, updates: Partial<Medicine>): Promise<Medicine> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await pharmacyAPI.updateMedicine(id, updates)
      
      // Update the medicine in local state
      setMedicines(prev => prev.map(medicine => 
        medicine.id === id ? { ...medicine, ...result } : medicine
      ))
      
      toast({
        title: 'Success',
        description: 'Medicine updated successfully',
      })
      
      return result
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to update medicine'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const loadStockMovements = useCallback(async (medicineId: string, params?: { page?: number; per_page?: number }) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await pharmacyAPI.getStockMovements(medicineId, params)
      setStockMovements(response.data || [])
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to load stock movements'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const receiveStock = useCallback(async (stockData: {
    medicine_id: string
    movement_type: string
    quantity: number
    batch_number?: string
    expiry_date?: string
    reference_type?: string
    reference_id?: string
    notes?: string
  }): Promise<StockMovement> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await pharmacyAPI.receiveStock(stockData)
      
      // Update the medicine's current stock in local state
      setMedicines(prev => prev.map(medicine => {
        if (medicine.id === stockData.medicine_id) {
          const newStock = stockData.movement_type === 'in' 
            ? medicine.current_stock + stockData.quantity
            : medicine.current_stock - stockData.quantity
          return { ...medicine, current_stock: newStock }
        }
        return medicine
      }))
      
      // Add the stock movement to local state
      setStockMovements(prev => [result, ...prev])
      
      toast({
        title: 'Success',
        description: 'Stock received successfully',
      })
      
      return result
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to receive stock'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const loadStockAlerts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const alerts = await pharmacyAPI.getStockAlerts()
      setStockAlerts(alerts)
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : 'Failed to load stock alerts'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const getLowStockMedicines = useCallback((): Medicine[] => {
    return medicines.filter(medicine => medicine.current_stock <= medicine.minimum_stock)
  }, [medicines])

  const getExpiredMedicines = useCallback((): Medicine[] => {
    const today = new Date().toISOString().split('T')[0]
    return medicines.filter(medicine => 
      medicine.expiry_date && medicine.expiry_date < today && medicine.current_stock > 0
    )
  }, [medicines])

  const getExpiringMedicines = useCallback((days: number = 30): Medicine[] => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)
    const futureDateStr = futureDate.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    
    return medicines.filter(medicine => 
      medicine.expiry_date && 
      medicine.expiry_date >= today && 
      medicine.expiry_date <= futureDateStr &&
      medicine.current_stock > 0
    )
  }, [medicines])

  const checkStock = useCallback((medicineId: string, requiredQuantity: number): boolean => {
    const medicine = getMedicine(medicineId)
    return medicine ? medicine.current_stock >= requiredQuantity : false
  }, [getMedicine])

  // Load initial data
  useEffect(() => {
    loadMedicines()
    loadStockAlerts()
  }, [loadMedicines, loadStockAlerts])

  const value: InventoryContextType = {
    // State
    medicines,
    stockMovements,
    stockAlerts,
    loading,
    error,
    
    // Medicine operations
    loadMedicines,
    getMedicine,
    addMedicine,
    updateMedicine,
    
    // Stock operations
    loadStockMovements,
    receiveStock,
    
    // Alerts
    loadStockAlerts,
    getLowStockMedicines,
    getExpiredMedicines,
    getExpiringMedicines,
    
    // Utility functions
    checkStock,
    clearError,
  }

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventoryEnhanced() {
  const context = useContext(InventoryContext)
  if (context === undefined) {
    throw new Error('useInventoryEnhanced must be used within an InventoryProviderEnhanced')
  }
  return context
}

// Legacy exports for backward compatibility
export const useInventory = useInventoryEnhanced
export const InventoryProvider = InventoryProviderEnhanced
