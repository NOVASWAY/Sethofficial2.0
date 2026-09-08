'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { type Medicine } from '@/components/medicine-catalog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
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
  const { user } = useAuth()

  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Define loadMedicines before useEffect to avoid hoisting issues
  const loadMedicines = async () => {
    try {
      const medicinesData = await pharmacyAPI.getMedicines()
      setMedicines(medicinesData.data || [])
    } catch (error) {
      console.error('Error loading medicines from API:', error)
      throw error
    }
  }

  // Load from API on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await loadMedicines()
        // Load stock movements from API (fetch all medicines' movements)
        try {
          const medsData = await pharmacyAPI.getMedicines()
          const meds = medsData.data || []
          let allMovements: StockMovement[] = []
          for (const med of meds) {
            try {
              const movementsData = await pharmacyAPI.getStockMovements(med.id)
              if (movementsData?.data) {
                allMovements = [...allMovements, ...movementsData.data.map((m: any) => ({
                  id: m.id,
                  medicineId: m.medicineId || med.id,
                  medicineName: m.medicineName || `${med.name} ${med.strength || ''}`.trim(),
                  movementType: m.movementType,
                  quantity: m.quantity,
                  reason: m.notes || m.reason || '',
                  performedBy: m.performedBy || 'System',
                  timestamp: m.timestamp || m.createdAt,
                  referenceNumber: m.referenceId,
                }))]
              }
            } catch {
              // Individual medicine movements unavailable
            }
          }
          setStockMovements(allMovements)
        } catch {
          setStockMovements([])
        }
      } catch (error) {
        console.error('Failed to load inventory from API:', error)
        // Fallback to default medicines
        setMedicines([])
      } finally {
        setIsInitialized(true)
      }
    }

    loadData()
  }, [])

  const getMedicine = (id: string): Medicine | undefined => {
    return medicines.find(m => m.id === id)
  }

  const checkStock = (medicineId: string, requiredQuantity: number): boolean => {
    const medicine = getMedicine(medicineId)
    if (!medicine) return false
    return medicine.currentStock >= requiredQuantity
  }

  const updateStock = async (
    medicineId: string,
    quantity: number,
    movementType: StockMovement['movementType'],
    reason: string,
    referenceNumber?: string
  ): Promise<boolean> => {
    const medicine = getMedicine(medicineId)
    if (!medicine) {
      toast({
        variant: 'error',
        title: 'Medicine Not Found',
        description: 'Unable to update stock for unknown medicine',
      })
      return false
    }

    let newStock = medicine.currentStock
    let stockChange = 0

    switch (movementType) {
      case 'dispensing':
      case 'sale':
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
        newStock = medicine.currentStock + quantity
        stockChange = quantity
        break
      case 'adjustment':
        newStock = quantity
        stockChange = quantity - medicine.currentStock
        break
      default:
        return false
    }

    try {
      // Persist to API
      await fetch(`/api/medicines/${medicineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentStock: newStock }),
      })

      await fetch('/api/stock-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicationId: medicineId,
          movementType,
          quantity: Math.abs(stockChange),
          previousQuantity: medicine.currentStock,
          newQuantity: newStock,
          referenceType: referenceNumber || movementType,
          notes: reason,
        }),
      })

      // Update local state
      setMedicines(prev =>
        prev.map(m =>
          m.id === medicineId
            ? { ...m, currentStock: newStock, updatedAt: new Date().toISOString() }
            : m
        )
      )

      const movement: StockMovement = {
        id: crypto.randomUUID(),
        medicineId,
        medicineName: `${medicine.name} ${medicine.strength}`,
        movementType,
        quantity: Math.abs(stockChange),
        reason,
        performedBy: user?.name || user?.email || 'System',
        timestamp: new Date().toISOString(),
        referenceNumber,
      }
      setStockMovements(prev => [movement, ...prev])

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
    } catch (error) {
      console.error('Failed to update stock via API:', error)
      toast({
        variant: 'error',
        title: 'Stock Update Failed',
        description: 'Could not save stock changes to server',
      })
      return false
    }
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

