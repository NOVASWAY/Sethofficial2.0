'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Package, TrendingDown, TrendingUp, AlertTriangle, 
  CheckCircle2, Search, Plus, FileText, Calendar, BarChart3
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Medication {
  id: string
  name: string
  generic_name: string
  category: string
  batch_number: string
  quantity: number
  reorder_level: number
  unit_price: number
  expiry_date: string
  location: string
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired'
  last_updated: string
}

interface StockMovement {
  id: string
  medication_id: string
  medication_name: string
  movement_type: 'purchase' | 'sale' | 'adjustment' | 'return' | 'expired' | 'damaged'
  quantity: number
  previous_quantity: number
  new_quantity: number
  unit_cost?: number
  total_cost?: number
  notes: string
  created_by: string
  created_at: string
}

export function StockReconciliationModule() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const [medications, setMedications] = useState<Medication[]>([
    {
      id: '1',
      name: 'Amoxicillin 500mg',
      generic_name: 'Amoxicillin',
      category: 'Antibiotics',
      batch_number: 'AMX-2024-001',
      quantity: 150,
      reorder_level: 50,
      unit_price: 15.00,
      expiry_date: '2025-12-31',
      location: 'Shelf A1',
      status: 'in_stock',
      last_updated: '2025-10-01',
    },
    {
      id: '2',
      name: 'Paracetamol 500mg',
      generic_name: 'Paracetamol',
      category: 'Analgesics',
      batch_number: 'PAR-2024-015',
      quantity: 25,
      reorder_level: 30,
      unit_price: 5.00,
      expiry_date: '2025-11-15',
      location: 'Shelf B2',
      status: 'low_stock',
      last_updated: '2025-09-28',
    },
    {
      id: '3',
      name: 'Ibuprofen 400mg',
      generic_name: 'Ibuprofen',
      category: 'Analgesics',
      batch_number: 'IBU-2024-008',
      quantity: 0,
      reorder_level: 20,
      unit_price: 8.00,
      expiry_date: '2025-10-05',
      location: 'Shelf B3',
      status: 'out_of_stock',
      last_updated: '2025-10-02',
    },
  ])

  const [movements, setMovements] = useState<StockMovement[]>([
    {
      id: '1',
      medication_id: '1',
      medication_name: 'Amoxicillin 500mg',
      movement_type: 'sale',
      quantity: 21,
      previous_quantity: 171,
      new_quantity: 150,
      notes: 'Dispensed for prescription RX-202510-001',
      created_by: 'Jane Pharmacist',
      created_at: '2025-10-02T14:30:00Z',
    },
    {
      id: '2',
      medication_id: '2',
      medication_name: 'Paracetamol 500mg',
      movement_type: 'purchase',
      quantity: 50,
      previous_quantity: 25,
      new_quantity: 75,
      unit_cost: 5.00,
      total_cost: 250.00,
      notes: 'Stock replenishment from supplier',
      created_by: 'Admin User',
      created_at: '2025-10-01T10:00:00Z',
    },
  ])

  const [adjustmentForm, setAdjustmentForm] = useState({
    medication_id: '',
    movement_type: 'adjustment' as const,
    quantity: 0,
    unit_cost: 0,
    notes: '',
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge variant="outline" className="bg-green-50 text-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />In Stock</Badge>
      case 'low_stock':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700"><AlertTriangle className="h-3 w-3 mr-1" />Low Stock</Badge>
      case 'out_of_stock':
        return <Badge variant="outline" className="bg-red-50 text-red-700"><TrendingDown className="h-3 w-3 mr-1" />Out of Stock</Badge>
      case 'expired':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'purchase':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'sale':
        return <TrendingDown className="h-4 w-4 text-blue-600" />
      case 'adjustment':
        return <FileText className="h-4 w-4 text-yellow-600" />
      case 'expired':
      case 'damaged':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const handleStockAdjustment = async () => {
    if (!adjustmentForm.medication_id || adjustmentForm.quantity === 0) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: 'Please select a medication and enter quantity',
      })
      return
    }

    setLoading(true)
    try {
      // TODO: Replace with actual API call
      const medication = medications.find(m => m.id === adjustmentForm.medication_id)
      if (!medication) return

      const newMovement: StockMovement = {
        id: String(movements.length + 1),
        medication_id: adjustmentForm.medication_id,
        medication_name: medication.name,
        movement_type: adjustmentForm.movement_type,
        quantity: Math.abs(adjustmentForm.quantity),
        previous_quantity: medication.quantity,
        new_quantity: medication.quantity + adjustmentForm.quantity,
        unit_cost: adjustmentForm.unit_cost || undefined,
        total_cost: adjustmentForm.unit_cost ? Math.abs(adjustmentForm.quantity) * adjustmentForm.unit_cost : undefined,
        notes: adjustmentForm.notes,
        created_by: 'Current User',
        created_at: new Date().toISOString(),
      }

      setMovements([newMovement, ...movements])
      
      // Update medication quantity
      setMedications(prev => prev.map(m => 
        m.id === adjustmentForm.medication_id
          ? { ...m, quantity: m.quantity + adjustmentForm.quantity, last_updated: new Date().toISOString().split('T')[0] }
          : m
      ))

      toast({
        title: 'Stock Updated',
        description: `${medication.name} stock adjusted successfully`,
      })

      // Reset form
      setAdjustmentForm({
        medication_id: '',
        movement_type: 'adjustment',
        quantity: 0,
        unit_cost: 0,
        notes: '',
      })
    } catch (error) {
      toast({
        variant: 'error',
        title: 'Update Failed',
        description: 'Unable to update stock. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredMedications = medications.filter(med => {
    const matchesSearch = med.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         med.generic_name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || med.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const stockSummary = {
    totalItems: medications.length,
    inStock: medications.filter(m => m.status === 'in_stock').length,
    lowStock: medications.filter(m => m.status === 'low_stock').length,
    outOfStock: medications.filter(m => m.status === 'out_of_stock').length,
    totalValue: medications.reduce((sum, m) => sum + (m.quantity * m.unit_price), 0),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stock Reconciliation</h2>
          <p className="text-muted-foreground">
            Manage inventory, track stock movements, and maintain optimal levels
          </p>
        </div>
      </div>

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{stockSummary.totalItems}</p>
              </div>
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Stock</p>
                <p className="text-2xl font-bold text-green-600">{stockSummary.inStock}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-yellow-600">{stockSummary.lowStock}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{stockSummary.outOfStock}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">KES {stockSummary.totalValue.toFixed(2)}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">
            <Package className="h-4 w-4 mr-2" />
            Inventory Overview
          </TabsTrigger>
          <TabsTrigger value="movements">
            <FileText className="h-4 w-4 mr-2" />
            Stock Movements
          </TabsTrigger>
          <TabsTrigger value="adjustment">
            <Plus className="h-4 w-4 mr-2" />
            Stock Adjustment
          </TabsTrigger>
        </TabsList>

        {/* Inventory Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Medication Inventory</CardTitle>
                <div className="flex gap-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Antibiotics">Antibiotics</SelectItem>
                      <SelectItem value="Analgesics">Analgesics</SelectItem>
                      <SelectItem value="Antihypertensives">Antihypertensives</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search medications..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-[250px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredMedications.map((medication) => (
                  <Card key={medication.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{medication.name}</h4>
                            {getStatusBadge(medication.status)}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Generic:</span> {medication.generic_name}
                            </div>
                            <div>
                              <span className="font-medium">Category:</span> {medication.category}
                            </div>
                            <div>
                              <span className="font-medium">Batch:</span> {medication.batch_number}
                            </div>
                            <div>
                              <span className="font-medium">Location:</span> {medication.location}
                            </div>
                            <div>
                              <span className="font-medium">Quantity:</span> {medication.quantity} units
                            </div>
                            <div>
                              <span className="font-medium">Reorder Level:</span> {medication.reorder_level} units
                            </div>
                            <div>
                              <span className="font-medium">Unit Price:</span> KES {medication.unit_price.toFixed(2)}
                            </div>
                            <div>
                              <span className="font-medium">Expiry:</span> {new Date(medication.expiry_date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Stock Value</p>
                          <p className="text-lg font-bold">
                            KES {(medication.quantity * medication.unit_price).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Movements Tab */}
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Stock Movements</CardTitle>
              <CardDescription>Track all inventory changes and transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {movements.map((movement) => (
                  <Card key={movement.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        {getMovementIcon(movement.movement_type)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{movement.medication_name}</h4>
                            <Badge variant="outline" className="capitalize">{movement.movement_type}</Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                            <div>
                              <span className="font-medium">Quantity:</span> {movement.quantity} units
                            </div>
                            <div>
                              <span className="font-medium">Previous:</span> {movement.previous_quantity}
                            </div>
                            <div>
                              <span className="font-medium">New:</span> {movement.new_quantity}
                            </div>
                            {movement.total_cost && (
                              <div>
                                <span className="font-medium">Cost:</span> KES {movement.total_cost.toFixed(2)}
                              </div>
                            )}
                          </div>
                          {movement.notes && (
                            <p className="text-sm text-muted-foreground mt-2 italic">{movement.notes}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(movement.created_at).toLocaleString()}
                            </span>
                            <span>By: {movement.created_by}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Adjustment Tab */}
        <TabsContent value="adjustment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Adjustment</CardTitle>
              <CardDescription>Add, remove, or adjust inventory quantities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Medication *</Label>
                  <Select
                    value={adjustmentForm.medication_id}
                    onValueChange={(value) => setAdjustmentForm({ ...adjustmentForm, medication_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select medication" />
                    </SelectTrigger>
                    <SelectContent>
                      {medications.map((med) => (
                        <SelectItem key={med.id} value={med.id}>
                          {med.name} (Current: {med.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Movement Type *</Label>
                  <Select
                    value={adjustmentForm.movement_type}
                    onValueChange={(value: any) => setAdjustmentForm({ ...adjustmentForm, movement_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">Purchase (Add)</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                      <SelectItem value="return">Return (Add)</SelectItem>
                      <SelectItem value="expired">Mark as Expired</SelectItem>
                      <SelectItem value="damaged">Mark as Damaged</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity * (use - for removal)</Label>
                  <Input
                    type="number"
                    value={adjustmentForm.quantity}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantity: parseInt(e.target.value) })}
                    placeholder="e.g., 50 or -10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Unit Cost (optional)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={adjustmentForm.unit_cost}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, unit_cost: parseFloat(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={adjustmentForm.notes}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
                    placeholder="Reason for adjustment..."
                    rows={3}
                  />
                </div>
              </div>

              {adjustmentForm.unit_cost > 0 && adjustmentForm.quantity !== 0 && (
                <Alert>
                  <BarChart3 className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-semibold">Total Cost: </span>
                    KES {(Math.abs(adjustmentForm.quantity) * adjustmentForm.unit_cost).toFixed(2)}
                  </AlertDescription>
                </Alert>
              )}

              <Button onClick={handleStockAdjustment} disabled={loading} className="w-full" size="lg">
                <CheckCircle2 className="mr-2 h-5 w-5" />
                {loading ? 'Processing...' : 'Update Stock'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

