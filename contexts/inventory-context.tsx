'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { defaultMedicines, type Medicine } from '@/components/medicine-catalog'
import { useToast } from '@/hooks/use-toast'
import { pharmacyAPI } from '../lib/api-client'

// Removed localStorage keys - now using API calls

interface StockMovement {
  id: string
  medicineId: string
  medicineName: string
  movementType: 'dispensing' | 'sale' | 'adjustment' | 'receiving' | 'return'
  quantity: number
  reason: string
  performedBy: string
  timestamp: string
  referenceNumber?: string
}

interface InventoryContextType {
  medicines: Medicine[]
  stockMovements: StockMovement[]
  getMedicine: (id: string) => Medicine | undefined
  addMedicine: (medicine: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Medicine>
  updateMedicine: (id: string, updates: Partial<Medicine>) => Promise<boolean>
  updateStock: (medicineId: string, quantity: number, movementType: StockMovement['movementType'], reason: string, referenceNumber?: string) => Promise<boolean>
  checkStock: (medicineId: string, requiredQuantity: number) => boolean
  getLowStockMedicines: () => Medicine[]
  getOutOfStockMedicines: () => Medicine[]
  loadMedicines: () => Promise<void>
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined)

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  
  // Add expiry data to medicines
  const medicinesWithExpiry = defaultMedicines.map((med, index) => {
    // Add sample batch data for demonstration
    const batches = []
    
    // Add some expired batches for first 2 medicines
    if (index === 0) {
      batches.push({
        batchNumber: 'BATCH-2023-001',
        expiryDate: '2024-12-01', // Expired
        quantity: 200,
        receivedDate: '2023-06-01',
      })
    }
    
    if (index === 1) {
      batches.push({
        batchNumber: 'BATCH-2024-002',
        expiryDate: '2025-01-15', // Expired
        quantity: 150,
        receivedDate: '2023-08-01',
      })
    }
    
    // Add critical expiry (within 30 days) for next 2 medicines
    if (index === 2 || index === 3) {
      const criticalDate = new Date()
      criticalDate.setDate(criticalDate.getDate() + 20) // 20 days from now
      batches.push({
        batchNumber: `BATCH-2024-${index + 10}`,
        expiryDate: criticalDate.toISOString().split('T')[0],
        quantity: 300,
        receivedDate: '2024-06-01',
      })
    }
    
    // Add warning expiry (within 90 days) for next 2 medicines
    if (index === 4 || index === 5) {
      const warningDate = new Date()
      warningDate.setDate(warningDate.getDate() + 60) // 60 days from now
      batches.push({
        batchNumber: `BATCH-2024-${index + 20}`,
        expiryDate: warningDate.toISOString().split('T')[0],
        quantity: 500,
        receivedDate: '2024-08-01',
      })
    }
    
    // Add normal expiry for others
    const normalDate = new Date()
    normalDate.setMonth(normalDate.getMonth() + 12) // 1 year from now
    batches.push({
      batchNumber: `BATCH-2025-${index + 1}`,
      expiryDate: normalDate.toISOString().split('T')[0],
      quantity: med.currentStock - batches.reduce((sum, b) => sum + b.quantity, 0),
      receivedDate: '2025-01-01',
    })
    
    // Find nearest expiry
    const nearestExpiry = batches.reduce((nearest, batch) => {
      return new Date(batch.expiryDate) < new Date(nearest) ? batch.expiryDate : nearest
    }, batches[0].expiryDate)
    
    return {
      ...med,
      batches,
      nearestExpiry,
    }
  })
  
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from API on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await loadMedicines()
        // TODO: Load stock movements from API when endpoint is available
        setStockMovements([])
      } catch (error) {
        console.error('Failed to load inventory from API:', error)
        // Fallback to default medicines
        setMedicines(medicinesWithExpiry)
      } finally {
        setIsInitialized(true)
      }
    }

    loadData()
  }, [])

  // Removed localStorage save effects - data is now persisted via API calls

  const loadMedicines = async () => {
    try {
      const medicinesData = await pharmacyAPI.getMedicines()
      setMedicines(medicinesData.data || [])
    } catch (error) {
      console.error('Error loading medicines from API:', error)
      throw error
    }
  }

  const getMedicine = (id: string): Medicine | undefined => {
    return medicines.find(m => m.id === id)
  }

  const checkStock = (medicineId: string, requiredQuantity: number): boolean => {
    const medicine = getMedicine(medicineId)
    if (!medicine) return false
    return medicine.currentStock >= requiredQuantity
  }

  const updateStock = (
    medicineId: string,
    quantity: number,
    movementType: StockMovement['movementType'],
    reason: string,
    referenceNumber?: string
  ): boolean => {
    const medicine = getMedicine(medicineId)
    if (!medicine) {
      toast({
        variant: 'error',
        title: 'Medicine Not Found',
        description: 'Unable to update stock for unknown medicine',
      })
      return false
    }

    // Calculate new stock based on movement type
    let newStock = medicine.currentStock
    let stockChange = 0

    switch (movementType) {
      case 'dispensing':
      case 'sale':
        // Deduct stock
        if (medicine.currentStock < quantity) {
          toast({
            variant: 'error',
            title: 'Insufficient Stock',
            description: `Only ${medicine.currentStock} units available for ${medicine.name}`,
          })
          return false
        }
        newStock = medicine.currentStock - quantity
        stockChange = -quantity
        break

      case 'receiving':
      case 'return':
        // Add stock
        newStock = medicine.currentStock + quantity
        stockChange = quantity
        break

      case 'adjustment':
        // Direct adjustment
        newStock = quantity
        stockChange = quantity - medicine.currentStock
        break

      default:
        return false
    }

    // Update medicine stock
    setMedicines(prev =>
      prev.map(m =>
        m.id === medicineId
          ? { ...m, currentStock: newStock, updatedAt: new Date().toISOString() }
          : m
      )
    )

    // Record stock movement
    const movement: StockMovement = {
      id: crypto.randomUUID(),
      medicineId,
      medicineName: `${medicine.name} ${medicine.strength}`,
      movementType,
      quantity: Math.abs(stockChange),
      reason,
      performedBy: 'Current User', // TODO: Get from auth context
      timestamp: new Date().toISOString(),
      referenceNumber,
    }

    setStockMovements(prev => [movement, ...prev])

    // Show alert if stock is low
    if (newStock <= medicine.minStock && newStock > 0) {
      toast({
        title: 'Low Stock Alert',
        description: `${medicine.name} is running low. Current: ${newStock}, Min: ${medicine.minStock}`,
        variant: 'info',
      })
    } else if (newStock === 0) {
      toast({
        title: 'Out of Stock',
        description: `${medicine.name} is now out of stock`,
        variant: 'error',
      })
    }

    return true
  }

  const getLowStockMedicines = (): Medicine[] => {
    return medicines.filter(m => m.currentStock > 0 && m.currentStock <= m.minStock)
  }

  const getOutOfStockMedicines = (): Medicine[] => {
    return medicines.filter(m => m.currentStock === 0)
  }

  const addMedicine = async (medicineData: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>): Promise<Medicine> => {
    try {
      const newMedicine = await pharmacyAPI.addMedicine(medicineData)
      setMedicines(prev => [...prev, newMedicine])
      toast({
        title: "Medicine Added",
        description: `${newMedicine.name} has been added to inventory.`,
      })
      return newMedicine
    } catch (error) {
      console.error('Error adding medicine:', error)
      toast({
        title: "Error",
        description: "Failed to add medicine. Please try again.",
        variant: "destructive",
      })
      throw error
    }
  }

  const updateMedicine = async (id: string, updates: Partial<Medicine>): Promise<boolean> => {
    try {
      const updatedMedicine = await pharmacyAPI.updateMedicine(id, updates)
      setMedicines(prev =>
        prev.map(m => m.id === id ? updatedMedicine : m)
      )

      toast({
        title: "Medicine Updated",
        description: `${updatedMedicine.name} has been updated.`,
      })

      return true
    } catch (error) {
      console.error('Error updating medicine:', error)
      toast({
        title: "Error",
        description: "Failed to update medicine. Please try again.",
        variant: "destructive",
      })
      return false
    }
  }

  const value: InventoryContextType = {
    medicines,
    stockMovements,
    getMedicine,
    addMedicine,
    updateMedicine,
    updateStock,
    checkStock,
    getLowStockMedicines,
    getOutOfStockMedicines,
    loadMedicines,
  }

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  )
}

export function useInventory() {
  const context = useContext(InventoryContext)
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider')
  }
  return context
}

