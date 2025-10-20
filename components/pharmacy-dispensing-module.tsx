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
  const { medicines, updateStock, checkStock, getMedicine } = useInventory()
  const { checkMedicationAllergy, getPatientAllergies } = usePatient()
  const [activeTab, setActiveTab] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [dispensingNotes, setDispensingNotes] = useState('')
  const [batchNumber, setBatchNumber] = useState('')

  // Walk-in sale state
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('')
  const [medicineQuantity, setMedicineQuantity] = useState<string>('1')
  const [walkInItems, setWalkInItems] = useState<WalkInItem[]>([])

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([
    {
      id: '1',
      prescription_number: 'RX-202510-001',
      patient_id: 'PAT-2025-0001',
      patient_name: 'John Doe',
      clinician_name: 'Dr. Sarah Johnson',
      medication_name: 'Amoxicillin 500mg',
      dosage: '500mg',
      frequency: 'Three times daily',
      duration_days: 7,
      quantity: 21,
      instructions: 'Take after meals',
      status: 'pending',
      created_at: '2025-10-02T10:30:00Z',
      available_stock: 150,
      expiry_date: '2026-06-30',
    },
    {
      id: '2',
      prescription_number: 'RX-202510-002',
      patient_id: 'PAT-2025-0015',
      patient_name: 'Jane Smith',
      clinician_name: 'Dr. Michael Brown',
      medication_name: 'Ibuprofen 400mg',
      dosage: '400mg',
      frequency: 'Twice daily',
      duration_days: 5,
      quantity: 10,
      instructions: 'Take with food',
      status: 'pending',
      created_at: '2025-10-02T11:15:00Z',
      available_stock: 5,
      expiry_date: '2025-11-15',
    },
  ])

  const handleSearch = () => {
    // TODO: Implement actual search API call
    toast({
      title: 'Search',
      description: `Searching for: ${searchTerm}`,
    })
  }

  const handleDispense = async () => {
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

      // Update local state
      setPrescriptions(prev =>
        prev.map(p =>
          p.id === selectedPrescription.id
            ? { ...p, status: 'dispensed' as const, dispensed_at: new Date().toISOString() }
            : p
        )
      )

      toast({
        title: 'Medication Dispensed',
        description: `${selectedPrescription.medication_name} dispensed successfully. Stock updated.`,
      })

      setSelectedPrescription(null)
      setDispensingNotes('')
      setBatchNumber('')
      setActiveTab('dispensed')
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

    const total = walkInItems.reduce((sum, item) => sum + item.total, 0)

    toast({
      title: 'Sale Completed',
      description: `Total: KSh ${total.toFixed(2)} - ${walkInItems.length} item(s) sold. Stock updated.`,
    })

    // TODO: Process payment via M-Pesa or Cash
    setWalkInItems([])
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
                    className={`cursor-pointer transition-colors hover:border-primary ${
                      selectedPrescription?.id === prescription.id ? 'border-primary bg-primary/5' : ''
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
                      <p className={`font-semibold ${
                        selectedPrescription.available_stock < selectedPrescription.quantity 
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

