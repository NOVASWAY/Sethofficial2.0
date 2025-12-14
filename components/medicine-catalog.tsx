'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Edit2, Search, Pill, AlertCircle, Package } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export interface MedicineBatch {
  batchNumber: string
  expiryDate: string
  quantity: number
  receivedDate: string
}

export interface Medicine {
  id: string
  code: string
  name: string
  genericName: string
  category: 'tablets' | 'capsules' | 'syrups' | 'injections' | 'creams' | 'drops' | 'other'
  manufacturer: string
  strength: string
  dosageForm: string
  unitPrice: number
  currentStock: number
  minStock: number
  maxStock: number
  requiresPrescription: boolean
  isActive: boolean
  batches?: MedicineBatch[]
  nearestExpiry?: string
  createdAt: string
  updatedAt: string
}

// Predefined medicine catalog with fixed prices
export const defaultMedicines: Medicine[] = []

interface MedicineCatalogProps {
  role?: string
}

export function MedicineCatalog({ role = 'admin' }: MedicineCatalogProps) {
  const { toast } = useToast()
  const [medicines, setMedicines] = useState<Medicine[]>(defaultMedicines)
  const [filteredMedicines, setFilteredMedicines] = useState<Medicine[]>(defaultMedicines)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    genericName: '',
    category: 'tablets' as Medicine['category'],
    manufacturer: '',
    strength: '',
    dosageForm: '',
    unitPrice: '',
    currentStock: '',
    minStock: '',
    maxStock: '',
    requiresPrescription: false,
  })

  const canManageMedicines = role === 'admin'

  const getStockStatus = (medicine: Medicine): 'low' | 'out' | 'ok' => {
    if (medicine.currentStock === 0) return 'out'
    if (medicine.currentStock <= medicine.minStock) return 'low'
    return 'ok'
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    filterMedicines(value, categoryFilter, stockFilter)
  }

  const handleCategoryFilter = (category: string) => {
    setCategoryFilter(category)
    filterMedicines(searchTerm, category, stockFilter)
  }

  const handleStockFilter = (stock: string) => {
    setStockFilter(stock)
    filterMedicines(searchTerm, categoryFilter, stock)
  }

  const filterMedicines = (search: string, category: string, stock: string) => {
    let filtered = medicines

    if (category !== 'all') {
      filtered = filtered.filter(m => m.category === category)
    }

    if (stock === 'low') {
      filtered = filtered.filter(m => getStockStatus(m) === 'low')
    } else if (stock === 'out') {
      filtered = filtered.filter(m => getStockStatus(m) === 'out')
    }

    if (search) {
      filtered = filtered.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.genericName.toLowerCase().includes(search.toLowerCase()) ||
        m.code.toLowerCase().includes(search.toLowerCase()) ||
        m.manufacturer.toLowerCase().includes(search.toLowerCase())
      )
    }

    setFilteredMedicines(filtered)
  }

  const handleAddMedicine = () => {
    setFormData({
      code: '',
      name: '',
      genericName: '',
      category: 'tablets',
      manufacturer: '',
      strength: '',
      dosageForm: '',
      unitPrice: '',
      currentStock: '',
      minStock: '',
      maxStock: '',
      requiresPrescription: false,
    })
    setIsAddDialogOpen(true)
  }

  const handleEditMedicine = (medicine: Medicine) => {
    setSelectedMedicine(medicine)
    setFormData({
      code: medicine.code,
      name: medicine.name,
      genericName: medicine.genericName,
      category: medicine.category,
      manufacturer: medicine.manufacturer,
      strength: medicine.strength,
      dosageForm: medicine.dosageForm,
      unitPrice: medicine.unitPrice.toString(),
      currentStock: medicine.currentStock.toString(),
      minStock: medicine.minStock.toString(),
      maxStock: medicine.maxStock.toString(),
      requiresPrescription: medicine.requiresPrescription,
    })
    setIsEditDialogOpen(true)
  }

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const newMedicine: Medicine = {
        id: crypto.randomUUID(),
        code: formData.code,
        name: formData.name,
        genericName: formData.genericName,
        category: formData.category,
        manufacturer: formData.manufacturer,
        strength: formData.strength,
        dosageForm: formData.dosageForm,
        unitPrice: parseFloat(formData.unitPrice),
        currentStock: parseInt(formData.currentStock),
        minStock: parseInt(formData.minStock),
        maxStock: parseInt(formData.maxStock),
        requiresPrescription: formData.requiresPrescription,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setMedicines([...medicines, newMedicine])
      setFilteredMedicines([...filteredMedicines, newMedicine])

      toast({
        title: 'Medicine Added',
        description: `${newMedicine.name} has been added to the catalog`,
      })

      setIsAddDialogOpen(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add medicine',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!selectedMedicine) return

      const updatedMedicine: Medicine = {
        ...selectedMedicine,
        code: formData.code,
        name: formData.name,
        genericName: formData.genericName,
        category: formData.category,
        manufacturer: formData.manufacturer,
        strength: formData.strength,
        dosageForm: formData.dosageForm,
        unitPrice: parseFloat(formData.unitPrice),
        currentStock: parseInt(formData.currentStock),
        minStock: parseInt(formData.minStock),
        maxStock: parseInt(formData.maxStock),
        requiresPrescription: formData.requiresPrescription,
        updatedAt: new Date().toISOString(),
      }

      setMedicines(medicines.map(m => m.id === selectedMedicine.id ? updatedMedicine : m))
      setFilteredMedicines(filteredMedicines.map(m => m.id === selectedMedicine.id ? updatedMedicine : m))

      toast({
        title: 'Medicine Updated',
        description: `${updatedMedicine.name} has been updated`,
      })

      setIsEditDialogOpen(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update medicine',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getCategoryColor = (category: Medicine['category']) => {
    switch (category) {
      case 'tablets': return 'bg-blue-100 text-blue-800'
      case 'capsules': return 'bg-green-100 text-green-800'
      case 'syrups': return 'bg-purple-100 text-purple-800'
      case 'injections': return 'bg-red-100 text-red-800'
      case 'creams': return 'bg-yellow-100 text-yellow-800'
      case 'drops': return 'bg-cyan-100 text-cyan-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const lowStockCount = medicines.filter(m => getStockStatus(m) === 'low').length
  const outOfStockCount = medicines.filter(m => getStockStatus(m) === 'out').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Medicine Catalog</h2>
          <p className="text-muted-foreground">
            Manage fixed prices for all pharmacy medicines
          </p>
        </div>
        {canManageMedicines && (
          <Button onClick={handleAddMedicine}>
            <Plus className="h-4 w-4 mr-2" />
            Add Medicine
          </Button>
        )}
      </div>

      {/* Stock Alerts */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lowStockCount > 0 && (
            <Alert className="border-yellow-500 bg-yellow-50">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <strong>{lowStockCount}</strong> medicine{lowStockCount > 1 ? 's' : ''} running low on stock
              </AlertDescription>
            </Alert>
          )}
          {outOfStockCount > 0 && (
            <Alert className="border-red-500 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <strong>{outOfStockCount}</strong> medicine{outOfStockCount > 1 ? 's' : ''} out of stock
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Medicines</CardTitle>
          <CardDescription>Find medicines by name, generic name, code, or manufacturer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search medicines..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={handleCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="tablets">Tablets</SelectItem>
                <SelectItem value="capsules">Capsules</SelectItem>
                <SelectItem value="syrups">Syrups</SelectItem>
                <SelectItem value="injections">Injections</SelectItem>
                <SelectItem value="creams">Creams/Ointments</SelectItem>
                <SelectItem value="drops">Drops</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={handleStockFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Stock Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Levels</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Medicines Table */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Medicines ({filteredMedicines.length})</TabsTrigger>
          <TabsTrigger value="tablets">Tablets ({medicines.filter(m => m.category === 'tablets').length})</TabsTrigger>
          <TabsTrigger value="capsules">Capsules ({medicines.filter(m => m.category === 'capsules').length})</TabsTrigger>
          <TabsTrigger value="syrups">Syrups ({medicines.filter(m => m.category === 'syrups').length})</TabsTrigger>
          <TabsTrigger value="injections">Injections ({medicines.filter(m => m.category === 'injections').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <MedicineTable
            medicines={filteredMedicines}
            onEdit={handleEditMedicine}
            canManage={canManageMedicines}
            getCategoryColor={getCategoryColor}
            getStockStatus={getStockStatus}
          />
        </TabsContent>

        {['tablets', 'capsules', 'syrups', 'injections'].map(cat => (
          <TabsContent key={cat} value={cat} className="space-y-4">
            <MedicineTable
              medicines={medicines.filter(m => m.category === cat)}
              onEdit={handleEditMedicine}
              canManage={canManageMedicines}
              getCategoryColor={getCategoryColor}
              getStockStatus={getStockStatus}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Add Medicine Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Medicine</DialogTitle>
            <DialogDescription>Create a new medicine with fixed pricing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Medicine Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., MED-016"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as Medicine['category'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tablets">Tablets</SelectItem>
                    <SelectItem value="capsules">Capsules</SelectItem>
                    <SelectItem value="syrups">Syrups/Suspensions</SelectItem>
                    <SelectItem value="injections">Injections</SelectItem>
                    <SelectItem value="creams">Creams/Ointments</SelectItem>
                    <SelectItem value="drops">Drops</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Brand Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Paracetamol"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="genericName">Generic Name *</Label>
                <Input
                  id="genericName"
                  value={formData.genericName}
                  onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                  placeholder="e.g., Acetaminophen"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer *</Label>
                <Input
                  id="manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  placeholder="e.g., Cosmos Ltd"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="strength">Strength *</Label>
                <Input
                  id="strength"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                  placeholder="e.g., 500mg"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dosageForm">Dosage Form *</Label>
                <Input
                  id="dosageForm"
                  value={formData.dosageForm}
                  onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })}
                  placeholder="e.g., Tablet, Syrup, Injection"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price (KSh) *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  placeholder="e.g., 2.50"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentStock">Current Stock *</Label>
                <Input
                  id="currentStock"
                  type="number"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  placeholder="e.g., 5000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Min Stock *</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  placeholder="e.g., 1000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxStock">Max Stock *</Label>
                <Input
                  id="maxStock"
                  type="number"
                  value={formData.maxStock}
                  onChange={(e) => setFormData({ ...formData, maxStock: e.target.value })}
                  placeholder="e.g., 10000"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requiresPrescription"
                checked={formData.requiresPrescription}
                onChange={(e) => setFormData({ ...formData, requiresPrescription: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="requiresPrescription" className="cursor-pointer">
                Requires Prescription
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Adding...' : 'Add Medicine'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Medicine Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Medicine</DialogTitle>
            <DialogDescription>Update medicine details and pricing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Medicine Code *</Label>
                <Input
                  id="edit-code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as Medicine['category'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tablets">Tablets</SelectItem>
                    <SelectItem value="capsules">Capsules</SelectItem>
                    <SelectItem value="syrups">Syrups/Suspensions</SelectItem>
                    <SelectItem value="injections">Injections</SelectItem>
                    <SelectItem value="creams">Creams/Ointments</SelectItem>
                    <SelectItem value="drops">Drops</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Brand Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-genericName">Generic Name *</Label>
                <Input
                  id="edit-genericName"
                  value={formData.genericName}
                  onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-manufacturer">Manufacturer *</Label>
                <Input
                  id="edit-manufacturer"
                  value={formData.manufacturer}
                  onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-strength">Strength *</Label>
                <Input
                  id="edit-strength"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-dosageForm">Dosage Form *</Label>
                <Input
                  id="edit-dosageForm"
                  value={formData.dosageForm}
                  onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unitPrice">Unit Price (KSh) *</Label>
                <Input
                  id="edit-unitPrice"
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-currentStock">Current Stock *</Label>
                <Input
                  id="edit-currentStock"
                  type="number"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-minStock">Min Stock *</Label>
                <Input
                  id="edit-minStock"
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-maxStock">Max Stock *</Label>
                <Input
                  id="edit-maxStock"
                  type="number"
                  value={formData.maxStock}
                  onChange={(e) => setFormData({ ...formData, maxStock: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-requiresPrescription"
                checked={formData.requiresPrescription}
                onChange={(e) => setFormData({ ...formData, requiresPrescription: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-requiresPrescription" className="cursor-pointer">
                Requires Prescription
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Medicine'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface MedicineTableProps {
  medicines: Medicine[]
  onEdit: (medicine: Medicine) => void
  canManage: boolean
  getCategoryColor: (category: Medicine['category']) => string
  getStockStatus: (medicine: Medicine) => 'low' | 'out' | 'ok'
}

function MedicineTable({ medicines, onEdit, canManage, getCategoryColor, getStockStatus }: MedicineTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Medicine Name</TableHead>
              <TableHead>Generic Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Strength</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              {canManage && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {medicines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No medicines found
                </TableCell>
              </TableRow>
            ) : (
              medicines.map((medicine) => {
                const stockStatus = getStockStatus(medicine)
                return (
                  <TableRow key={medicine.id} className={stockStatus === 'out' ? 'bg-red-50' : stockStatus === 'low' ? 'bg-yellow-50' : ''}>
                    <TableCell className="font-mono text-sm">{medicine.code}</TableCell>
                    <TableCell className="font-medium">
                      {medicine.name}
                      {medicine.requiresPrescription && (
                        <Badge variant="outline" className="ml-2 text-xs">Rx</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{medicine.genericName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getCategoryColor(medicine.category)}>
                        {medicine.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{medicine.strength}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{medicine.manufacturer}</TableCell>
                    <TableCell className="text-right font-semibold">
                      KSh {medicine.unitPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={
                          stockStatus === 'out' ? 'text-red-600 font-semibold' :
                            stockStatus === 'low' ? 'text-yellow-600 font-semibold' :
                              'text-green-600'
                        }>
                          {medicine.currentStock.toLocaleString()}
                        </span>
                        {stockStatus === 'out' && (
                          <Badge variant="destructive" className="text-xs">Out</Badge>
                        )}
                        {stockStatus === 'low' && (
                          <Badge className="bg-yellow-500 text-xs">Low</Badge>
                        )}
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(medicine)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

