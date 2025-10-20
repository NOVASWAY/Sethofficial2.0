'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  PackagePlus, Truck, CheckCircle2, Clock, Package, 
  Calendar, AlertTriangle, Plus, Trash2, Download
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useInventory } from '@/contexts/inventory-context'

interface BatchItem {
  id: string
  medicineId: string
  medicineName: string
  batchNumber: string
  quantity: number
  unitPrice: number
  expiryDate: string
  manufacturingDate: string
}

interface PurchaseOrder {
  id: string
  poNumber: string
  supplier: string
  orderDate: string
  expectedDelivery: string
  status: 'pending' | 'received' | 'partial'
  items: BatchItem[]
  totalValue: number
  receivedDate?: string
  receivedBy?: string
}

export function StockReceiving() {
  const { toast } = useToast()
  const { medicines, updateStock } = useInventory()
  
  const [isReceivingOpen, setIsReceivingOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('receive')
  
  // Mock purchase orders
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([
    {
      id: '1',
      poNumber: 'PO-2025-001',
      supplier: 'MedSupply Kenya Ltd',
      orderDate: '2025-10-01',
      expectedDelivery: '2025-10-05',
      status: 'pending',
      items: [
        {
          id: '1',
          medicineId: 'MED-001',
          medicineName: 'Amoxicillin 500mg',
          batchNumber: '',
          quantity: 500,
          unitPrice: 15,
          expiryDate: '',
          manufacturingDate: '',
        },
      ],
      totalValue: 7500,
    },
  ])

  const [receivingData, setReceivingData] = useState({
    supplier: '',
    invoiceNumber: '',
    deliveryNote: '',
    receivedBy: 'Current User',
    receivedDate: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [newBatchItem, setNewBatchItem] = useState<Partial<BatchItem>>({
    medicineId: '',
    medicineName: '',
    batchNumber: '',
    quantity: 0,
    unitPrice: 0,
    expiryDate: '',
    manufacturingDate: '',
  })

  const handleAddBatchItem = () => {
    if (!newBatchItem.medicineId || !newBatchItem.batchNumber || !newBatchItem.quantity || !newBatchItem.expiryDate) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: 'Please fill in all required fields',
      })
      return
    }

    const medicine = medicines.find(m => m.id === newBatchItem.medicineId)
    if (!medicine) {
      toast({
        variant: 'error',
        title: 'Medicine Not Found',
        description: 'Selected medicine not found in catalog',
      })
      return
    }

    const batchItem: BatchItem = {
      id: crypto.randomUUID(),
      medicineId: newBatchItem.medicineId!,
      medicineName: medicine.name,
      batchNumber: newBatchItem.batchNumber!,
      quantity: newBatchItem.quantity!,
      unitPrice: newBatchItem.unitPrice || medicine.unitPrice,
      expiryDate: newBatchItem.expiryDate!,
      manufacturingDate: newBatchItem.manufacturingDate || new Date().toISOString().split('T')[0],
    }

    setBatchItems([...batchItems, batchItem])
    setNewBatchItem({
      medicineId: '',
      medicineName: '',
      batchNumber: '',
      quantity: 0,
      unitPrice: 0,
      expiryDate: '',
      manufacturingDate: '',
    })

    toast({
      title: 'Batch Added',
      description: `${medicine.name} batch added to receiving list`,
    })
  }

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems(batchItems.filter(item => item.id !== id))
  }

  const handleReceiveStock = () => {
    if (batchItems.length === 0) {
      toast({
        variant: 'error',
        title: 'No Items',
        description: 'Please add at least one batch item',
      })
      return
    }

    if (!receivingData.supplier || !receivingData.invoiceNumber) {
      toast({
        variant: 'error',
        title: 'Validation Error',
        description: 'Supplier and invoice number are required',
      })
      return
    }

    // Update stock for each batch
    batchItems.forEach(item => {
      updateStock(
        item.medicineId,
        item.quantity, // Add stock (positive quantity increases stock)
        'receiving',
        `Stock received: ${receivingData.supplier} - Invoice ${receivingData.invoiceNumber} - Batch ${item.batchNumber}`,
        receivingData.invoiceNumber
      )
    })

    toast({
      title: 'Stock Received',
      description: `${batchItems.length} batch(es) received successfully. Total: ${batchItems.reduce((sum, item) => sum + item.quantity, 0)} units`,
    })

    // Reset form
    setBatchItems([])
    setReceivingData({
      supplier: '',
      invoiceNumber: '',
      deliveryNote: '',
      receivedBy: 'Current User',
      receivedDate: new Date().toISOString().split('T')[0],
      notes: '',
    })
    setIsReceivingOpen(false)
  }

  const handleReceivePO = (poId: string) => {
    const po = purchaseOrders.find(p => p.id === poId)
    if (!po) return

    // Pre-fill receiving form with PO data
    setReceivingData({
      ...receivingData,
      supplier: po.supplier,
      invoiceNumber: `INV-${po.poNumber}`,
    })

    setBatchItems(po.items.map(item => ({
      ...item,
      batchNumber: item.batchNumber || `BATCH-${Date.now()}`,
      expiryDate: item.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      manufacturingDate: item.manufacturingDate || new Date().toISOString().split('T')[0],
    })))

    setIsReceivingOpen(true)
    setActiveTab('receive')
  }

  const handleExportReceiving = () => {
    let reportData = `STOCK RECEIVING REPORT\nGenerated: ${new Date().toLocaleString()}\n\n`
    reportData += `Supplier: ${receivingData.supplier}\n`
    reportData += `Invoice Number: ${receivingData.invoiceNumber}\n`
    reportData += `Received Date: ${receivingData.receivedDate}\n`
    reportData += `Received By: ${receivingData.receivedBy}\n\n`
    reportData += `BATCH DETAILS\n${'='.repeat(100)}\n\n`
    
    batchItems.forEach((item, index) => {
      reportData += `${index + 1}. ${item.medicineName}\n`
      reportData += `   Batch Number: ${item.batchNumber}\n`
      reportData += `   Quantity: ${item.quantity} units\n`
      reportData += `   Unit Price: KES ${item.unitPrice}\n`
      reportData += `   Total Value: KES ${(item.quantity * item.unitPrice).toLocaleString()}\n`
      reportData += `   Expiry Date: ${item.expiryDate}\n`
      reportData += `   Manufacturing Date: ${item.manufacturingDate}\n\n`
    })

    const totalValue = batchItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
    const totalQuantity = batchItems.reduce((sum, item) => sum + item.quantity, 0)
    
    reportData += `${'='.repeat(100)}\n`
    reportData += `SUMMARY\n`
    reportData += `Total Batches: ${batchItems.length}\n`
    reportData += `Total Units: ${totalQuantity}\n`
    reportData += `Total Value: KES ${totalValue.toLocaleString()}\n`

    const blob = new Blob([reportData], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `stock-receiving-${receivingData.invoiceNumber}-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Report Exported',
      description: 'Stock receiving report has been downloaded',
    })
  }

  const totalReceivingValue = batchItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Stock Receiving</h2>
          <p className="text-muted-foreground">
            Receive and track incoming stock with batch and expiry management
          </p>
        </div>
        <Button size="lg" onClick={() => setIsReceivingOpen(true)}>
          <PackagePlus className="mr-2 h-4 w-4" />
          Receive Stock
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="receive">Receive Stock</TabsTrigger>
          <TabsTrigger value="purchase-orders">
            Purchase Orders ({purchaseOrders.filter(po => po.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="history">Receiving History</TabsTrigger>
        </TabsList>

        <TabsContent value="receive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Stock Receiving</CardTitle>
              <CardDescription>Receive stock without a purchase order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <PackagePlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">No active receiving session</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Receive Stock" to start receiving new inventory
                </p>
                <Button onClick={() => setIsReceivingOpen(true)}>
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Start Receiving
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchase-orders" className="space-y-4">
          {purchaseOrders.filter(po => po.status === 'pending').length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Truck className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium mb-2">No Pending Purchase Orders</p>
                <p className="text-sm text-muted-foreground">
                  All purchase orders have been received
                </p>
              </CardContent>
            </Card>
          ) : (
            purchaseOrders
              .filter(po => po.status === 'pending')
              .map(po => (
                <Card key={po.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{po.poNumber}</CardTitle>
                        <CardDescription>{po.supplier}</CardDescription>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Order Date</p>
                          <p className="font-medium">{new Date(po.orderDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expected Delivery</p>
                          <p className="font-medium">{new Date(po.expectedDelivery).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Total Value</p>
                          <p className="font-medium">KES {po.totalValue.toLocaleString()}</p>
                        </div>
                      </div>

                      <div>
                        <p className="font-medium mb-2">Items ({po.items.length})</p>
                        <div className="space-y-1">
                          {po.items.map(item => (
                            <div key={item.id} className="text-sm flex justify-between">
                              <span>{item.medicineName}</span>
                              <span className="text-muted-foreground">{item.quantity} units</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button className="w-full" onClick={() => handleReceivePO(po.id)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Receive Stock
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Receiving History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No receiving history yet</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Receiving Dialog */}
      <Dialog open={isReceivingOpen} onOpenChange={setIsReceivingOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive Stock</DialogTitle>
            <DialogDescription>Record incoming stock with batch and expiry details</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Receiving Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Receiving Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier *</Label>
                    <Input
                      id="supplier"
                      value={receivingData.supplier}
                      onChange={(e) => setReceivingData({ ...receivingData, supplier: e.target.value })}
                      placeholder="Supplier name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">Invoice Number *</Label>
                    <Input
                      id="invoiceNumber"
                      value={receivingData.invoiceNumber}
                      onChange={(e) => setReceivingData({ ...receivingData, invoiceNumber: e.target.value })}
                      placeholder="INV-12345"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deliveryNote">Delivery Note (Optional)</Label>
                    <Input
                      id="deliveryNote"
                      value={receivingData.deliveryNote}
                      onChange={(e) => setReceivingData({ ...receivingData, deliveryNote: e.target.value })}
                      placeholder="DN-12345"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receivedDate">Received Date</Label>
                    <Input
                      id="receivedDate"
                      type="date"
                      value={receivingData.receivedDate}
                      onChange={(e) => setReceivingData({ ...receivingData, receivedDate: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add Batch Item */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Batch Item</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="medicine">Medicine *</Label>
                    <Select
                      value={newBatchItem.medicineId}
                      onValueChange={(value) => {
                        const medicine = medicines.find(m => m.id === value)
                        setNewBatchItem({
                          ...newBatchItem,
                          medicineId: value,
                          medicineName: medicine?.name || '',
                          unitPrice: medicine?.unitPrice || 0,
                        })
                      }}
                    >
                      <SelectTrigger id="medicine">
                        <SelectValue placeholder="Select medicine" />
                      </SelectTrigger>
                      <SelectContent>
                        {medicines.map(med => (
                          <SelectItem key={med.id} value={med.id}>
                            {med.name} ({med.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batchNumber">Batch Number *</Label>
                    <Input
                      id="batchNumber"
                      value={newBatchItem.batchNumber}
                      onChange={(e) => setNewBatchItem({ ...newBatchItem, batchNumber: e.target.value })}
                      placeholder="BATCH-12345"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={newBatchItem.quantity || ''}
                      onChange={(e) => setNewBatchItem({ ...newBatchItem, quantity: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitPrice">Unit Price</Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      value={newBatchItem.unitPrice || ''}
                      onChange={(e) => setNewBatchItem({ ...newBatchItem, unitPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date *</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={newBatchItem.expiryDate}
                      onChange={(e) => setNewBatchItem({ ...newBatchItem, expiryDate: e.target.value })}
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={handleAddBatchItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Batch
                </Button>
              </CardContent>
            </Card>

            {/* Batch Items List */}
            {batchItems.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Batch Items ({batchItems.length})</CardTitle>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-xl font-bold">KES {totalReceivingValue.toLocaleString()}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {batchItems.map(item => (
                      <div key={item.id} className="flex items-start justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{item.medicineName}</p>
                          <div className="grid grid-cols-4 gap-2 mt-1 text-xs text-muted-foreground">
                            <span>Batch: {item.batchNumber}</span>
                            <span>Qty: {item.quantity}</span>
                            <span>Price: KES {item.unitPrice}</span>
                            <span>Expiry: {item.expiryDate}</span>
                          </div>
                          <p className="text-sm font-semibold mt-1">
                            Total: KES {(item.quantity * item.unitPrice).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveBatchItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={receivingData.notes}
                onChange={(e) => setReceivingData({ ...receivingData, notes: e.target.value })}
                placeholder="Any additional notes or remarks..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={handleExportReceiving} disabled={batchItems.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export Report
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setIsReceivingOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleReceiveStock} disabled={batchItems.length === 0}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Receive Stock ({batchItems.length} batch{batchItems.length !== 1 ? 'es' : ''})
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

