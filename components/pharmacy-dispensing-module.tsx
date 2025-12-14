'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Pill, Package, AlertTriangle, CheckCircle2, Clock,
  Search, FileText, User, Calendar, ShoppingCart, Plus, Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { defaultMedicines, type Medicine } from './medicine-catalog'
import { useInventory } from '@/contexts/inventory-context'
import { usePatient } from '@/contexts/patient-context'
import { invoiceAPI, prescriptionAPI } from '@/lib/api-client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'

interface Prescription {
  id: string
  prescription_number: string
  patient_id: string
  patient_name: string
  clinician_name: string
  medication_name: string
  dosage: string
  frequency: string
  duration_days: number
  quantity: number
  instructions: string
  status: 'pending' | 'dispensed' | 'cancelled'
  created_at: string
  dispensed_at?: string
  available_stock: number
  expiry_date?: string
}

interface WalkInItem {
  id: string
  medicineId: string
  medicineName: string
  unitPrice: number
  quantity: number
  total: number
}

export function PharmacyDispensingModule() {
  const { toast } = useToast()
  const router = useRouter()
  const { user } = useAuth()
  const { medicines, updateStock, checkStock, getMedicine } = useInventory()
  const { checkMedicationAllergy, getPatientAllergies } = usePatient()
  const [activeTab, setActiveTab] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [dispensingNotes, setDispensingNotes] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [showBillingDialog, setShowBillingDialog] = useState(false)
  const [pendingInvoice, setPendingInvoice] = useState<{
    patientId: string
    patientName: string
    items: Array<{ description: string; quantity: number; unitPrice: number; totalPrice: number }>
    total: number
    prescriptionId?: string
  } | null>(null)

  // Walk-in sale state
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('')
  const [medicineQuantity, setMedicineQuantity] = useState<string>('1')
  const [walkInItems, setWalkInItems] = useState<WalkInItem[]>([])

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])

  // Load prescriptions from API
  useEffect(() => {
    const fetchPrescriptions = async () => {
      try {
        setLoading(true)
        // Fetch pending prescriptions by default, or all if needed
        const result = await prescriptionAPI.getAll({ status: 'pending' })
        if (result && result.data && Array.isArray(result.data)) {
          // Transform API response to fit component state if necessary
          // Assuming API response matches Prescription interface roughly or we map it
          const mapped: Prescription[] = result.data.map((p: any) => ({
            id: p.id,
            prescription_number: p.prescription_number || p.id,
            patient_id: p.patient_id,
            patient_name: p.patient_name || 'Unknown',
            clinician_name: p.clinician_name || 'Unknown',
            medication_name: p.medication_name || 'Unknown',
            dosage: p.dosage || '',
            frequency: p.frequency || '',
            duration_days: p.duration_days || 0,
            quantity: p.quantity || 0,
            instructions: p.instructions || '',
            status: p.status || 'pending',
            created_at: p.created_at,
            available_stock: p.available_stock || 0, // This might need a separate check or check inventory context
            expiry_date: p.expiry_date
          }))
          setPrescriptions(mapped)
        }
      } catch (error) {
        console.error('Failed to load prescriptions:', error)
        toast({
          title: "Error",
          description: "Failed to load prescriptions from API",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPrescriptions()
  }, [])

  const handleSearch = async () => {
    if (!searchTerm) return
    try {
      setLoading(true)
      // TODO: Implement search parameter in API
      const result = await prescriptionAPI.getAll({ page: 1 }) // fallback for now
      // ... same mapping logic ...
      if (result && result.data && Array.isArray(result.data)) {
        const mapped: Prescription[] = result.data.map((p: any) => ({
          id: p.id,
          prescription_number: p.prescription_number || p.id,
          patient_id: p.patient_id,
          patient_name: p.patient_name || 'Unknown',
          clinician_name: p.clinician_name || 'Unknown',
          medication_name: p.medication_name || 'Unknown',
          dosage: p.dosage || '',
          frequency: p.frequency || '',
          duration_days: p.duration_days || 0,
          quantity: p.quantity || 0,
          instructions: p.instructions || '',
          status: p.status || 'pending',
          created_at: p.created_at,
          available_stock: p.available_stock || 0,
          expiry_date: p.expiry_date
        }))
        setPrescriptions(mapped.filter(p =>
          p.prescription_number.includes(searchTerm) ||
          p.patient_name.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      }
    } catch (error) {
      // ...
    } finally {
      setLoading(false)
    }
  }

  const handleDispense = async () => {
    // ZERO TRUST GUARD: Only Pharmacists and Admins can dispense
    const allowedRoles = ['pharmacist', 'admin']
    if (user && !allowedRoles.includes(user.role)) {
      toast({
        variant: 'destructive',
        title: 'Action Denied',
        description: `Your role (${user.role}) is not authorized to dispense medications.`,
        duration: 8000
      })
      return
    }
    if (!selectedPrescription) return

    setLoading(true)
    try {
      // Check for medication allergies FIRST
      const allergy = checkMedicationAllergy(selectedPrescription.patient_id, selectedPrescription.medication_name)
      if (allergy) {
        toast({
          variant: 'error',
          title: '⚠️ ALLERGY ALERT - DISPENSING BLOCKED',
          description: `Patient is allergic to ${allergy.allergen} (${allergy.severity}). Cannot dispense ${selectedPrescription.medication_name}.`,
          duration: 15000, // Show for 15 seconds
        })
        setLoading(false)
        return
      }

      // Find matching medicine in catalog
      const medicine = medicines.find(m =>
        m.name.toLowerCase().includes(selectedPrescription.medication_name.toLowerCase())
      )

      if (!medicine) {
        toast({
          variant: 'error',
          title: 'Medicine Not Found',
          description: 'Medicine not found in catalog',
        })
        setLoading(false)
        return
      }

      // Validate stock availability using inventory context
      if (!checkStock(medicine.id, selectedPrescription.quantity)) {
        toast({
          variant: 'error',
          title: 'Insufficient Stock',
          description: `Only ${medicine.currentStock} units available. Required: ${selectedPrescription.quantity}`,
        })
        setLoading(false)
        return
      }

      // Check expiry
      const expiryDate = new Date(selectedPrescription.expiry_date || '')
      const today = new Date()
      if (expiryDate < today) {
        toast({
          variant: 'error',
          title: 'Expired Medication',
          description: 'Cannot dispense expired medication',
        })
        setLoading(false)
        return
      }

      // Update stock in inventory context
      const stockUpdated = updateStock(
        medicine.id,
        selectedPrescription.quantity,
        'dispensing',
        `Prescription dispensing: ${selectedPrescription.prescription_number}`,
        selectedPrescription.prescription_number
      )

      if (!stockUpdated) {
        setLoading(false)
        return
      }

      const dispensingPayload = {
        prescription_id: selectedPrescription.id,
        dispensed_quantity: selectedPrescription.quantity,
        batch_number: batchNumber,
        notes: dispensingNotes,
        dispensed_at: new Date().toISOString(),
      }

      // TODO: Replace with actual API call
      // await fetch(`/api/prescriptions/${selectedPrescription.id}/dispense`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(dispensingPayload),
      // })

      // Calculate medication cost
      const medicationCost = medicine.unitPrice * selectedPrescription.quantity
      const taxAmount = medicationCost * 0.16 // 16% VAT
      const totalAmount = medicationCost + taxAmount

      // Create invoice for medication
      try {
        const invoiceItems = [{
          description: `${selectedPrescription.medication_name} - ${selectedPrescription.dosage}`,
          quantity: selectedPrescription.quantity,
          unit_price: medicine.unitPrice,
          total_price: medicationCost,
          diagnosis_code: undefined,
          diagnosis_description: undefined,
        }]

        const invoiceData = {
          patient_id: selectedPrescription.patient_id,
          date: new Date().toISOString().split('T')[0],
          items: invoiceItems,
          consultation_id: undefined, // Medications can be dispensed without consultation
          notes: `Prescription: ${selectedPrescription.prescription_number}. ${dispensingNotes || ''}`.trim(),
        }

        const invoiceResponse = await invoiceAPI.create(invoiceData)
        const newInvoice = invoiceResponse?.data || invoiceResponse

        // Update local state
        setPrescriptions(prev =>
          prev.map(p =>
            p.id === selectedPrescription.id
              ? { ...p, status: 'dispensed' as const, dispensed_at: new Date().toISOString() }
              : p
          )
        )

        const invoiceNumber = newInvoice?.invoice_number || newInvoice?.id || 'N/A'
        toast({
          title: 'Medication Dispensed & Invoiced',
          description: `${selectedPrescription.medication_name} dispensed. Invoice created for KSh ${totalAmount.toFixed(2)}. Redirecting to billing...`,
        })

        setSelectedPrescription(null)
        setDispensingNotes('')
        setBatchNumber('')
        setActiveTab('dispensed')

        // Redirect to billing after 2 seconds to process payment
        setTimeout(() => {
          const invoiceId = newInvoice?.id || newInvoice?.invoice_id
          if (invoiceId) {
            router.push(`/dashboard/${user?.role || 'receptionist'}/billing?invoiceId=${invoiceId}`)
          } else {
            router.push(`/dashboard/${user?.role || 'receptionist'}/billing`)
          }
        }, 2000)

      } catch (invoiceError) {
        console.error('Failed to create invoice:', invoiceError)
        // Still mark as dispensed even if invoice creation fails
        setPrescriptions(prev =>
          prev.map(p =>
            p.id === selectedPrescription.id
              ? { ...p, status: 'dispensed' as const, dispensed_at: new Date().toISOString() }
              : p
          )
        )

        toast({
          variant: 'error',
          title: 'Dispensing Completed, Invoice Failed',
          description: 'Medication dispensed but invoice creation failed. Please create invoice manually.',
        })

        setSelectedPrescription(null)
        setDispensingNotes('')
        setBatchNumber('')
        setActiveTab('dispensed')
      }
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Dispensing Failed',
        description: 'Unable to dispense medication. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  // Walk-in sale functions
  const handleAddMedicine = () => {
    if (!selectedMedicineId) {
      toast({
        variant: 'error',
        title: 'No Medicine Selected',
        description: 'Please select a medicine from the catalog',
      })
      return
    }

    const medicine = getMedicine(selectedMedicineId)
    if (!medicine) return

    const quantity = parseInt(medicineQuantity) || 1

    // Check stock using inventory context
    if (!checkStock(medicine.id, quantity)) {
      toast({
        variant: 'error',
        title: 'Insufficient Stock',
        description: `Only ${medicine.currentStock} units available`,
      })
      return
    }

    const newItem: WalkInItem = {
      id: crypto.randomUUID(),
      medicineId: medicine.id,
      medicineName: `${medicine.name} ${medicine.strength}`,
      unitPrice: medicine.unitPrice,
      quantity,
      total: medicine.unitPrice * quantity,
    }

    setWalkInItems([...walkInItems, newItem])
    setSelectedMedicineId('')
    setMedicineQuantity('1')

    toast({
      title: 'Medicine Added',
      description: `${medicine.name} added to sale`,
    })
  }

  const handleRemoveMedicine = (itemId: string) => {
    setWalkInItems(walkInItems.filter(item => item.id !== itemId))
    toast({
      title: 'Item Removed',
      description: 'Medicine removed from sale',
    })
  }

  const handleCompleteSale = () => {
    // ZERO TRUST GUARD: Only Pharmacists/Admins/Receptionists can process sales
    // Receptionists might be allowed for billing, but let's restrict walk-in sales if needed.
    // Assuming walk-in is loose, but let's stick to pharmacist/admin/receptionist for money handling.
    const allowedRoles = ['pharmacist', 'admin', 'receptionist']
    if (user && !allowedRoles.includes(user.role)) {
      toast({
        variant: 'destructive',
        title: 'Action Denied',
        description: `Your role (${user.role}) is not authorized to process walk-in sales.`,
        duration: 8000
      })
      return
    }
    if (walkInItems.length === 0) {
      toast({
        variant: 'error',
        title: 'No Items',
        description: 'Please add medicines to complete the sale',
      })
      return
    }

    // Update stock for each item
    let allStockUpdated = true
    const saleReference = `SALE-${Date.now()}`

    walkInItems.forEach(item => {
      const stockUpdated = updateStock(
        item.medicineId,
        item.quantity,
        'sale',
        `Walk-in sale: ${item.medicineName}`,
        saleReference
      )
      if (!stockUpdated) {
        allStockUpdated = false
      }
    })

    if (!allStockUpdated) {
      toast({
        variant: 'error',
        title: 'Sale Failed',
        description: 'Unable to update stock. Please try again.',
      })
      return
    }

    const subtotal = walkInItems.reduce((sum, item) => sum + item.total, 0)
    const taxAmount = subtotal * 0.16 // 16% VAT
    const total = subtotal + taxAmount

    // Create invoice for walk-in sale
    try {
      const invoiceItems = walkInItems.map(item => ({
        description: item.medicineName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.total,
        diagnosis_code: undefined,
        diagnosis_description: undefined,
      }))

      // For walk-in sales, we need patient info - prompt user or use a default
      // For now, we'll create invoice without patient_id (can be updated later)
      // Or redirect to billing module with items

      toast({
        title: 'Stock Updated',
        description: `Total: KSh ${total.toFixed(2)} - ${walkInItems.length} item(s). Redirecting to billing...`,
      })

      // Store items for billing
      setPendingInvoice({
        patientId: '', // Will need to select patient in billing
        patientName: 'Walk-in Customer',
        items: walkInItems.map(item => ({
          description: item.medicineName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.total
        })),
        total: total,
      })

      // Redirect to billing with items
      setTimeout(() => {
        router.push(`/dashboard/${user?.role || 'receptionist'}/billing?walkInItems=${encodeURIComponent(JSON.stringify(walkInItems))}`)
      }, 1500)

      setWalkInItems([])
    } catch (error) {
      console.error('Failed to process walk-in sale:', error)
      toast({
        variant: 'error',
        title: 'Sale Partially Completed',
        description: 'Stock updated but billing failed. Please create invoice manually.',
      })
      setWalkInItems([])
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'dispensed':
        return <Badge variant="outline" className="bg-green-50"><CheckCircle2 className="h-3 w-3 mr-1" />Dispensed</Badge>
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-50">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStockStatus = (available: number, required: number) => {
    if (available === 0) {
      return <Badge variant="outline" className="bg-red-50 text-red-700">Out of Stock</Badge>
    } else if (available < required) {
      return <Badge variant="outline" className="bg-orange-50 text-orange-700">Low Stock</Badge>
    } else if (available < 20) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Reorder Soon</Badge>
    }
    return <Badge variant="outline" className="bg-green-50 text-green-700">In Stock</Badge>
  }

  const filteredPrescriptions = prescriptions.filter(p => {
    if (activeTab === 'pending') return p.status === 'pending'
    if (activeTab === 'dispensed') return p.status === 'dispensed'
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Pharmacy Dispensing</h2>
          <p className="text-muted-foreground">
            Manage prescription dispensing and medication fulfillment
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="Search by prescription number, patient name, or medication..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Prescriptions List */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">
                <Clock className="h-4 w-4 mr-2" />
                Pending ({prescriptions.filter(p => p.status === 'pending').length})
              </TabsTrigger>
              <TabsTrigger value="walkin">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Walk-In Sale
              </TabsTrigger>
              <TabsTrigger value="dispensed">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Dispensed ({prescriptions.filter(p => p.status === 'dispensed').length})
              </TabsTrigger>
              <TabsTrigger value="all">
                <FileText className="h-4 w-4 mr-2" />
                All
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4 mt-4">
              {filteredPrescriptions.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No prescriptions found</p>
                  </CardContent>
                </Card>
              ) : (
                filteredPrescriptions.map((prescription) => (
                  <Card
                    key={prescription.id}
                    className={`cursor-pointer transition-colors hover:border-primary ${selectedPrescription?.id === prescription.id ? 'border-primary bg-primary/5' : ''
                      }`}
                    onClick={() => setSelectedPrescription(prescription)}
                  >
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-lg">{prescription.medication_name}</h4>
                              {getStatusBadge(prescription.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">{prescription.prescription_number}</p>
                          </div>
                          {getStockStatus(prescription.available_stock, prescription.quantity)}
                        </div>

                        <Separator />

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-muted-foreground">Patient</Label>
                            <p className="font-medium">{prescription.patient_name}</p>
                            <p className="text-xs text-muted-foreground">{prescription.patient_id}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Prescribed by</Label>
                            <p className="font-medium">{prescription.clinician_name}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <Label className="text-muted-foreground">Dosage</Label>
                            <p className="font-medium">{prescription.dosage}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Frequency</Label>
                            <p className="font-medium">{prescription.frequency}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Quantity</Label>
                            <p className="font-medium">{prescription.quantity} units</p>
                          </div>
                        </div>

                        {prescription.instructions && (
                          <Alert>
                            <FileText className="h-4 w-4" />
                            <AlertDescription>
                              <span className="font-semibold">Instructions: </span>
                              {prescription.instructions}
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created: {new Date(prescription.created_at).toLocaleString()}
                          </div>
                          {prescription.available_stock < prescription.quantity && (
                            <div className="flex items-center gap-1 text-orange-600">
                              <AlertTriangle className="h-3 w-3" />
                              Insufficient stock
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* Walk-In Sale Tab */}
            <TabsContent value="walkin" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Walk-In Medicine Sale</CardTitle>
                  <CardDescription>Select medicines from catalog for direct sales</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Medicine Selector */}
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    <Label className="font-semibold">Select Medicine from Catalog</Label>
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-7">
                        <Select value={selectedMedicineId} onValueChange={setSelectedMedicineId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a medicine..." />
                          </SelectTrigger>
                          <SelectContent>
                            {medicines
                              .filter(m => m.isActive && m.currentStock > 0)
                              .map((medicine) => (
                                <SelectItem key={medicine.id} value={medicine.id}>
                                  <div className="flex justify-between items-center w-full">
                                    <span>{medicine.name} {medicine.strength}</span>
                                    <span className="ml-4 text-muted-foreground">
                                      KSh {medicine.unitPrice.toFixed(2)} ({medicine.currentStock} in stock)
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          value={medicineQuantity}
                          onChange={(e) => setMedicineQuantity(e.target.value)}
                          placeholder="Qty"
                        />
                      </div>
                      <div className="col-span-3">
                        <Button onClick={handleAddMedicine} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Sale Items */}
                  <div className="space-y-3">
                    <Label className="font-semibold">Sale Items</Label>
                    {walkInItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground border rounded-lg">
                        <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No items added yet</p>
                        <p className="text-sm">Select medicines from the catalog above</p>
                      </div>
                    ) : (
                      <>
                        {walkInItems.map((item) => (
                          <div key={item.id} className="flex justify-between items-start p-3 border rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{item.medicineName}</p>
                              <p className="text-sm text-muted-foreground">
                                Qty: {item.quantity} × KSh {item.unitPrice.toFixed(2)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">KSh {item.total.toFixed(2)}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMedicine(item.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Separator />
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>Total</span>
                          <span>KSh {walkInItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}</span>
                        </div>
                        <Button onClick={handleCompleteSale} className="w-full" size="lg">
                          <CheckCircle2 className="h-5 w-5 mr-2" />
                          Complete Sale
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Dispensing Details */}
        <div>
          {selectedPrescription ? (
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Dispense Medication</CardTitle>
                <CardDescription>
                  Review and confirm dispensing details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Allergy Warning */}
                {(() => {
                  const allergy = checkMedicationAllergy(selectedPrescription.patient_id, selectedPrescription.medication_name)
                  if (allergy) {
                    return (
                      <Alert className="border-red-500 bg-red-50">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <AlertDescription>
                          <div className="font-bold text-red-900">⚠️ ALLERGY ALERT</div>
                          <div className="text-sm text-red-800 mt-1">
                            Patient is allergic to <span className="font-semibold">{allergy.allergen}</span> ({allergy.severity}).
                            <br />
                            <span className="font-semibold">DO NOT DISPENSE</span> this medication.
                          </div>
                        </AlertDescription>
                      </Alert>
                    )
                  }
                  return null
                })()}

                <div className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground">Medication</Label>
                    <p className="font-semibold">{selectedPrescription.medication_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Patient</Label>
                    <p className="font-semibold">{selectedPrescription.patient_name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-muted-foreground">Required</Label>
                      <p className="font-semibold">{selectedPrescription.quantity} units</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Available</Label>
                      <p className={`font-semibold ${selectedPrescription.available_stock < selectedPrescription.quantity
                        ? 'text-red-600'
                        : 'text-green-600'
                        }`}>
                        {selectedPrescription.available_stock} units
                      </p>
                    </div>
                  </div>
                  {selectedPrescription.expiry_date && (
                    <div>
                      <Label className="text-muted-foreground">Expiry Date</Label>
                      <p className="font-semibold">
                        {new Date(selectedPrescription.expiry_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {selectedPrescription.status === 'pending' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="batch_number">Batch Number</Label>
                      <Input
                        id="batch_number"
                        placeholder="Enter batch number"
                        value={batchNumber}
                        onChange={(e) => setBatchNumber(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="dispensing_notes">Notes</Label>
                      <Textarea
                        id="dispensing_notes"
                        placeholder="Any special notes or observations..."
                        value={dispensingNotes}
                        onChange={(e) => setDispensingNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    {selectedPrescription.quantity > selectedPrescription.available_stock && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Insufficient stock to fulfill this prescription
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      onClick={handleDispense}
                      disabled={loading || selectedPrescription.quantity > selectedPrescription.available_stock}
                      className="w-full"
                      size="lg"
                    >
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      {loading ? 'Dispensing...' : 'Dispense Medication'}
                    </Button>
                  </>
                )}

                {selectedPrescription.status === 'dispensed' && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-semibold text-green-700">Already Dispensed</p>
                        <p className="text-sm">
                          {selectedPrescription.dispensed_at &&
                            new Date(selectedPrescription.dispensed_at).toLocaleString()}
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a prescription to dispense</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

