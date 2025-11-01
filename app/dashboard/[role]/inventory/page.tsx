"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, Search, Plus, AlertTriangle, TrendingDown, TrendingUp, Filter, Edit2, RefreshCw } from "lucide-react"
import { useParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { useInventory } from "@/contexts/inventory-context"
import { usePurchaseOrders } from "@/contexts/purchase-order-context"
import { pharmacyAPI } from "@/lib/api-client"

export default function InventoryPage() {
  const params = useParams()
  const role = params.role as string
  const { toast } = useToast()
  const { medicines, addMedicine, updateMedicine } = useInventory()
  const { addPurchaseOrder, suppliers, getActiveSuppliers } = usePurchaseOrders()
  
  const [isAddItemOpen, setIsAddItemOpen] = useState(false)
  const [isEditItemOpen, setIsEditItemOpen] = useState(false)
  const [isReorderOpen, setIsReorderOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [newItemData, setNewItemData] = useState({
    name: '',
    category: '',
    currentStock: 0,
    minStock: 0,
    maxStock: 0,
    unitPrice: 0,
    supplier: '',
    expiryDate: '',
  })

  const [reorderData, setReorderData] = useState({
    quantity: 0,
    supplier: '',
    expectedDate: '',
    notes: '',
  })

  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  // Fetch medicines from API on mount and when context updates
  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        setLoading(true)
        const result = await pharmacyAPI.getMedicines({ page: 1, per_page: 200 })
        
        if (result && Array.isArray(result.data)) {
          const transformed = result.data.map((med: any) => ({
            id: med.id,
            name: med.name,
            genericName: med.generic_name,
            category: med.category || med.dosage_form || 'other',
            currentStock: med.current_stock || med.currentStock || 0,
            minStock: med.minimum_stock || med.minStock || 0,
            maxStock: med.maximum_stock || med.minimum_stock * 10 || 0,
            unitPrice: med.unit_price || med.unitPrice || 0,
            supplier: med.manufacturer || med.supplier || "Unknown",
            expiryDate: med.expiry_date || med.expiryDate || "",
            status: med.current_stock === 0 ? "out-of-stock" : 
                    med.current_stock <= med.minimum_stock ? "low-stock" : "in-stock",
            strength: med.strength,
            dosageForm: med.dosage_form,
            batchNumber: med.batch_number
          }))
          setInventoryItems(transformed)
        }
      } catch (error) {
        console.error("Error fetching medicines:", error)
        toast({
          title: "Error",
          description: "Failed to load inventory. Using cached data.",
          variant: "destructive"
        })
        // Fallback to context medicines
        setInventoryItems(medicines.map(med => ({
          id: med.id,
          name: med.name,
          category: med.category,
          currentStock: med.currentStock,
          minStock: med.minStock,
          maxStock: med.minStock * 10,
          unitPrice: med.unitPrice,
          supplier: "Supplier",
          expiryDate: "",
          status: med.currentStock === 0 ? "out-of-stock" : med.currentStock <= med.minStock ? "low-stock" : "in-stock",
        })))
      } finally {
        setLoading(false)
      }
    }

    fetchMedicines()
  }, [medicines.length, toast])

  // Map medicines from InventoryContext to inventory format (fallback)
  const inventory = (inventoryItems.length > 0 ? inventoryItems : medicines.map(med => ({
    id: med.id,
    name: med.name,
    category: med.category,
    currentStock: med.currentStock,
    minStock: med.minStock,
    maxStock: med.minStock * 10, // Estimate max as 10x min
    unitPrice: med.unitPrice,
    supplier: "Supplier", // Not available in Medicine interface
    expiryDate: "", // Would need to track batches
    status: med.currentStock === 0 ? "out-of-stock" : med.currentStock <= med.minStock ? "low-stock" : "in-stock",
  }))).filter(item => 
    searchTerm === "" || 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.genericName && item.genericName.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in-stock":
        return "bg-green-500"
      case "low-stock":
        return "bg-yellow-500"
      case "out-of-stock":
        return "bg-red-500"
      case "expired":
        return "bg-red-600"
      default:
        return "bg-gray-500"
    }
  }

  const getStockLevel = (current: number, min: number, max: number) => {
    const percentage = (current / max) * 100
    if (current === 0) return "empty"
    if (current <= min) return "low"
    if (percentage >= 80) return "high"
    return "normal"
  }

  const handleAddItem = () => {
    setIsAddItemOpen(true)
  }

  const handleEditItem = (item: any) => {
    setSelectedItem(item)
    setNewItemData({
      name: item.name,
      category: item.category,
      currentStock: item.currentStock,
      minStock: item.minStock,
      maxStock: item.maxStock,
      unitPrice: item.unitPrice,
      supplier: item.supplier,
      expiryDate: item.expiryDate,
    })
    setIsEditItemOpen(true)
  }

  const handleReorder = (item: any) => {
    setSelectedItem(item)
    setReorderData({
      quantity: item.minStock * 2, // Default to 2x min stock
      supplier: item.supplier,
      expectedDate: '',
      notes: '',
    })
    setIsReorderOpen(true)
  }

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Create medicine via API
      const newMedicine = await pharmacyAPI.addMedicine({
        name: newItemData.name,
        generic_name: newItemData.name,
        dosage_form: newItemData.category || 'other',
        strength: 'N/A',
        manufacturer: newItemData.supplier || 'Generic',
        unit_price: newItemData.unitPrice,
        current_stock: newItemData.currentStock,
        minimum_stock: newItemData.minStock,
        batch_number: `BATCH-${Date.now()}`,
        expiry_date: newItemData.expiryDate || null,
      })

      toast({
        title: "Item Added Successfully",
        description: `${newItemData.name} has been added to inventory.`,
      })

      // Refresh inventory list
      const result = await pharmacyAPI.getMedicines({ page: 1, per_page: 200 })
      if (result && Array.isArray(result.data)) {
        const transformed = result.data.map((med: any) => ({
          id: med.id,
          name: med.name,
          genericName: med.generic_name,
          category: med.category || med.dosage_form || 'other',
          currentStock: med.current_stock || 0,
          minStock: med.minimum_stock || 0,
          maxStock: med.minimum_stock * 10 || 0,
          unitPrice: med.unit_price || 0,
          supplier: med.manufacturer || "Unknown",
          expiryDate: med.expiry_date || "",
          status: med.current_stock === 0 ? "out-of-stock" : 
                  med.current_stock <= med.minimum_stock ? "low-stock" : "in-stock",
        }))
        setInventoryItems(transformed)
      }

      setNewItemData({
        name: '',
        category: '',
        currentStock: 0,
        minStock: 0,
        maxStock: 0,
        unitPrice: 0,
        supplier: '',
        expiryDate: '',
      })
      setIsAddItemOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item. Please try again.",
        variant: "error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (selectedItem) {
        // Update medicine via API
        await pharmacyAPI.updateMedicine(selectedItem.id, {
          name: newItemData.name,
          generic_name: newItemData.name,
          dosage_form: newItemData.category || 'other',
          unit_price: newItemData.unitPrice,
          current_stock: newItemData.currentStock,
          minimum_stock: newItemData.minStock,
          manufacturer: newItemData.supplier || 'Generic',
        })

        toast({
          title: "Item Updated Successfully",
          description: `${newItemData.name} has been updated.`,
        })

        // Refresh inventory list
        const result = await pharmacyAPI.getMedicines({ page: 1, per_page: 200 })
        if (result && Array.isArray(result.data)) {
          const transformed = result.data.map((med: any) => ({
            id: med.id,
            name: med.name,
            genericName: med.generic_name,
            category: med.category || med.dosage_form || 'other',
            currentStock: med.current_stock || 0,
            minStock: med.minimum_stock || 0,
            maxStock: med.minimum_stock * 10 || 0,
            unitPrice: med.unit_price || 0,
            supplier: med.manufacturer || "Unknown",
            expiryDate: med.expiry_date || "",
            status: med.current_stock === 0 ? "out-of-stock" : 
                    med.current_stock <= med.minimum_stock ? "low-stock" : "in-stock",
          }))
          setInventoryItems(transformed)
        }

        setIsEditItemOpen(false)
        setSelectedItem(null)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update item. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleReorderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (!selectedItem) {
      toast({
        title: "Error",
        description: "No item selected for reorder",
        variant: "error",
      })
      setIsLoading(false)
      return
    }

    try {
      // Find the supplier
      const supplier = suppliers.find(s => s.name === reorderData.supplier)
      if (!supplier) {
        toast({
          title: "Error",
          description: "Selected supplier not found",
          variant: "error",
        })
        setIsLoading(false)
        return
      }

      // Calculate pricing
      const unitPrice = selectedItem.unitPrice
      const totalPrice = reorderData.quantity * unitPrice
      const tax = totalPrice * 0.16 // 16% VAT
      const subtotal = totalPrice

      // Create purchase order
      const newOrder = addPurchaseOrder({
        supplier: supplier.name,
        supplierContact: supplier.phone,
        orderDate: new Date().toISOString(),
        expectedDelivery: reorderData.expectedDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        status: 'draft',
        items: [{
          id: `POI${String(Date.now()).slice(-6)}`,
          medicineId: selectedItem.id,
          medicineName: selectedItem.name,
          quantity: reorderData.quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          supplier: supplier.name,
          notes: reorderData.notes,
        }],
        subtotal: subtotal,
        tax: tax,
        total: subtotal + tax,
        notes: `Reorder for ${selectedItem.name} - ${reorderData.notes || 'Low stock alert'}`,
        createdBy: 'U001', // TODO: Get from auth context
      })

      toast({
        title: "Reorder Placed Successfully",
        description: `Purchase Order ${newOrder.orderNumber} created for ${reorderData.quantity} units of ${selectedItem.name}.`,
      })

      // Reset form
      setReorderData({
        quantity: 0,
        supplier: '',
        expectedDate: '',
        notes: '',
      })
      setIsReorderOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to place reorder. Please try again.",
        variant: "error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stock Management</h1>
            <p className="text-muted-foreground">Monitor and manage inventory levels</p>
          </div>
          <Button onClick={handleAddItem}>
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>

        {/* Stock Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inventory.length}</div>
              <p className="text-xs text-muted-foreground">Active inventory items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <TrendingDown className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {inventory.filter((item) => item.status === "low-stock").length}
              </div>
              <p className="text-xs text-muted-foreground">Items need restocking</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {inventory.filter((item) => item.status === "out-of-stock").length}
              </div>
              <p className="text-xs text-muted-foreground">Items unavailable</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                KSh{" "}
                {inventory.reduce((total, item) => total + item.currentStock * item.unitPrice, 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Current inventory value</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Items</TabsTrigger>
            <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
            <TabsTrigger value="out-of-stock">Out of Stock</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          <div className="flex items-center space-x-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input 
                placeholder="Search inventory..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  setLoading(true)
                  const result = await pharmacyAPI.getMedicines({ page: 1, per_page: 200 })
                  if (result && Array.isArray(result.data)) {
                    const transformed = result.data.map((med: any) => ({
                      id: med.id,
                      name: med.name,
                      genericName: med.generic_name,
                      category: med.category || med.dosage_form || 'other',
                      currentStock: med.current_stock || 0,
                      minStock: med.minimum_stock || 0,
                      maxStock: med.minimum_stock * 10 || 0,
                      unitPrice: med.unit_price || 0,
                      supplier: med.manufacturer || "Unknown",
                      expiryDate: med.expiry_date || "",
                      status: med.current_stock === 0 ? "out-of-stock" : 
                              med.current_stock <= med.minimum_stock ? "low-stock" : "in-stock",
                    }))
                    setInventoryItems(transformed)
                    toast({
                      title: "Refreshed",
                      description: "Inventory data has been refreshed.",
                    })
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to refresh inventory.",
                    variant: "destructive"
                  })
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>

          <TabsContent value="all" className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Loading inventory...</p>
                </CardContent>
              </Card>
            ) : inventory.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No inventory items found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {inventory.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-4">
                          <span className="font-medium">{item.name}</span>
                          <Badge variant="outline">{item.category}</Badge>
                          <Badge className={getStatusColor(item.status)}>{item.status.replace("-", " ")}</Badge>
                        </div>

                        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                          <div>Stock: {item.currentStock} units</div>
                          <div>Min: {item.minStock}</div>
                          <div>Max: {item.maxStock}</div>
                          <div>Price: KSh {item.unitPrice}</div>
                          <div>Expires: {item.expiryDate}</div>
                        </div>

                        <div className="text-sm text-muted-foreground">Supplier: {item.supplier}</div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditItem(item)}>
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleReorder(item)}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reorder
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="low-stock">
            <div className="grid gap-4">
              {inventory
                .filter((item) => item.status === "low-stock")
                .map((item) => (
                  <Card key={item.id} className="border-yellow-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-4">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                            <span className="font-medium">{item.name}</span>
                            <Badge variant="outline">{item.category}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Current: {item.currentStock} units (Below minimum of {item.minStock})
                          </div>
                        </div>
                        <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600" onClick={() => handleReorder(item)}>
                          Reorder Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="out-of-stock">
            <div className="grid gap-4">
              {inventory
                .filter((item) => item.status === "out-of-stock")
                .map((item) => (
                  <Card key={item.id} className="border-red-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-4">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <span className="font-medium">{item.name}</span>
                            <Badge variant="outline">{item.category}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Out of stock - Minimum required: {item.minStock} units
                          </div>
                        </div>
                        <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={() => handleReorder(item)}>
                          Urgent Reorder
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <CardTitle>Inventory by Category</CardTitle>
                <CardDescription>Stock levels organized by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from(new Set(inventory.map((item) => item.category))).map((category) => {
                    const categoryItems = inventory.filter((item) => item.category === category)
                    const totalValue = categoryItems.reduce((sum, item) => sum + item.currentStock * item.unitPrice, 0)
                    return (
                      <div key={category} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{category}</p>
                          <p className="text-sm text-muted-foreground">
                            {categoryItems.length} items • KSh {totalValue.toLocaleString()}
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          View Items
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Item Dialog */}
        <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Inventory Item</DialogTitle>
              <DialogDescription>Add a new item to stock inventory</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddItemSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    value={newItemData.name}
                    onChange={(e) => setNewItemData({...newItemData, name: e.target.value})}
                    placeholder="e.g., Paracetamol 500mg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={newItemData.category} onValueChange={(value) => setNewItemData({...newItemData, category: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Analgesics">Analgesics</SelectItem>
                      <SelectItem value="Antibiotics">Antibiotics</SelectItem>
                      <SelectItem value="Diabetes">Diabetes</SelectItem>
                      <SelectItem value="Medical Supplies">Medical Supplies</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier *</Label>
                  <Input
                    id="supplier"
                    value={newItemData.supplier}
                    onChange={(e) => setNewItemData({...newItemData, supplier: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentStock">Current Stock *</Label>
                  <Input
                    id="currentStock"
                    type="number"
                    value={newItemData.currentStock}
                    onChange={(e) => setNewItemData({...newItemData, currentStock: Number(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minStock">Minimum Stock *</Label>
                  <Input
                    id="minStock"
                    type="number"
                    value={newItemData.minStock}
                    onChange={(e) => setNewItemData({...newItemData, minStock: Number(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxStock">Maximum Stock *</Label>
                  <Input
                    id="maxStock"
                    type="number"
                    value={newItemData.maxStock}
                    onChange={(e) => setNewItemData({...newItemData, maxStock: Number(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unitPrice">Unit Price (KSh) *</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    value={newItemData.unitPrice}
                    onChange={(e) => setNewItemData({...newItemData, unitPrice: Number(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date *</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={newItemData.expiryDate}
                    onChange={(e) => setNewItemData({...newItemData, expiryDate: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsAddItemOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Adding...' : 'Add Item'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={isEditItemOpen} onOpenChange={setIsEditItemOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Inventory Item</DialogTitle>
              <DialogDescription>Update item information for {selectedItem?.name}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditItemSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-name">Item Name *</Label>
                  <Input
                    id="edit-name"
                    value={newItemData.name}
                    onChange={(e) => setNewItemData({...newItemData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category *</Label>
                  <Select value={newItemData.category} onValueChange={(value) => setNewItemData({...newItemData, category: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Analgesics">Analgesics</SelectItem>
                      <SelectItem value="Antibiotics">Antibiotics</SelectItem>
                      <SelectItem value="Diabetes">Diabetes</SelectItem>
                      <SelectItem value="Medical Supplies">Medical Supplies</SelectItem>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-supplier">Supplier *</Label>
                  <Input
                    id="edit-supplier"
                    value={newItemData.supplier}
                    onChange={(e) => setNewItemData({...newItemData, supplier: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-currentStock">Current Stock *</Label>
                  <Input
                    id="edit-currentStock"
                    type="number"
                    value={newItemData.currentStock}
                    onChange={(e) => setNewItemData({...newItemData, currentStock: Number(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-minStock">Minimum Stock *</Label>
                  <Input
                    id="edit-minStock"
                    type="number"
                    value={newItemData.minStock}
                    onChange={(e) => setNewItemData({...newItemData, minStock: Number(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-maxStock">Maximum Stock *</Label>
                  <Input
                    id="edit-maxStock"
                    type="number"
                    value={newItemData.maxStock}
                    onChange={(e) => setNewItemData({...newItemData, maxStock: Number(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-unitPrice">Unit Price (KSh) *</Label>
                  <Input
                    id="edit-unitPrice"
                    type="number"
                    step="0.01"
                    value={newItemData.unitPrice}
                    onChange={(e) => setNewItemData({...newItemData, unitPrice: Number(e.target.value)})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-expiryDate">Expiry Date *</Label>
                  <Input
                    id="edit-expiryDate"
                    type="date"
                    value={newItemData.expiryDate}
                    onChange={(e) => setNewItemData({...newItemData, expiryDate: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsEditItemOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Update Item'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Reorder Dialog */}
        <Dialog open={isReorderOpen} onOpenChange={setIsReorderOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Place Reorder</DialogTitle>
              <DialogDescription>Order new stock for {selectedItem?.name}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleReorderSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Current Stock Information</h4>
                  <div className="text-sm space-y-1">
                    <p>Current Stock: {selectedItem?.currentStock} units</p>
                    <p>Minimum Stock: {selectedItem?.minStock} units</p>
                    <p>Maximum Stock: {selectedItem?.maxStock} units</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reorder-quantity">Quantity to Order *</Label>
                  <Input
                    id="reorder-quantity"
                    type="number"
                    value={reorderData.quantity}
                    onChange={(e) => setReorderData({...reorderData, quantity: Number(e.target.value)})}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reorder-supplier">Supplier *</Label>
                  <Select 
                    value={reorderData.supplier} 
                    onValueChange={(value) => setReorderData({...reorderData, supplier: value})}
                  >
                    <SelectTrigger id="reorder-supplier">
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {getActiveSuppliers().map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.name}>
                          {supplier.name} - {supplier.contactPerson}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="expected-date">Expected Delivery Date</Label>
                  <Input
                    id="expected-date"
                    type="date"
                    value={reorderData.expectedDate}
                    onChange={(e) => setReorderData({...reorderData, expectedDate: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={reorderData.notes}
                    onChange={(e) => setReorderData({...reorderData, notes: e.target.value})}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsReorderOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Placing Order...' : 'Place Order'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
