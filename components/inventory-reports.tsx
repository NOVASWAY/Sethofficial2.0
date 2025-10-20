'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Package, DollarSign, TrendingUp, AlertTriangle, Calendar,
  Download, RefreshCw, BarChart3, PieChart as PieChartIcon
} from 'lucide-react'
import { useInventory } from '@/contexts/inventory-context'
import { useToast } from '@/hooks/use-toast'
import { getExpiryStatus } from '@/lib/expiry-utils'

export function InventoryReports() {
  const { toast } = useToast()
  const { medicines, stockMovements } = useInventory()
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })

  // Calculate stock valuation
  const totalStockValue = medicines.reduce((sum, med) => sum + (med.currentStock * med.unitPrice), 0)
  const lowStockValue = medicines
    .filter(med => med.currentStock <= med.minStock)
    .reduce((sum, med) => sum + (med.currentStock * med.unitPrice), 0)
  
  // Category breakdown
  const categoryBreakdown = medicines.reduce((acc, med) => {
    const category = med.category
    if (!acc[category]) {
      acc[category] = { count: 0, value: 0, stock: 0 }
    }
    acc[category].count++
    acc[category].value += med.currentStock * med.unitPrice
    acc[category].stock += med.currentStock
    return acc
  }, {} as Record<string, { count: number; value: number; stock: number }>)

  // Stock movements in date range
  const movementsInRange = stockMovements.filter(mov => {
    const movDate = new Date(mov.timestamp)
    return movDate >= new Date(dateRange.startDate) && movDate <= new Date(dateRange.endDate)
  })

  const movementsByType = movementsInRange.reduce((acc, mov) => {
    if (!acc[mov.type]) {
      acc[mov.type] = { count: 0, quantity: 0 }
    }
    acc[mov.type].count++
    acc[mov.type].quantity += mov.quantity
    return acc
  }, {} as Record<string, { count: number; quantity: number }>)

  // Expiry analysis
  const expiryAnalysis = medicines.reduce((acc, med) => {
    if (med.batches) {
      med.batches.forEach(batch => {
        const status = getExpiryStatus(batch.expiryDate)
        if (!acc[status]) {
          acc[status] = { count: 0, value: 0 }
        }
        acc[status].count++
        acc[status].value += batch.quantity * med.unitPrice
      })
    }
    return acc
  }, {} as Record<string, { count: number; value: number }>)

  const handleExportReport = (reportType: string) => {
    let reportData = ''
    let filename = ''

    if (reportType === 'valuation') {
      reportData = `INVENTORY VALUATION REPORT\nGenerated: ${new Date().toLocaleString()}\n\n`
      reportData += `SUMMARY\n`
      reportData += `Total Stock Value: KES ${totalStockValue.toLocaleString()}\n`
      reportData += `Low Stock Value: KES ${lowStockValue.toLocaleString()}\n`
      reportData += `Total Medicines: ${medicines.length}\n\n`
      reportData += `CATEGORY BREAKDOWN\n`
      Object.entries(categoryBreakdown).forEach(([category, data]) => {
        reportData += `${category}: ${data.count} items, ${data.stock} units, KES ${data.value.toLocaleString()}\n`
      })
      reportData += `\n\nDETAILED INVENTORY\n`
      medicines.forEach(med => {
        reportData += `${med.code} - ${med.name}: ${med.currentStock} units @ KES ${med.unitPrice} = KES ${(med.currentStock * med.unitPrice).toLocaleString()}\n`
      })
      filename = `inventory-valuation-${new Date().toISOString().split('T')[0]}.txt`
    } else if (reportType === 'movements') {
      reportData = `STOCK MOVEMENTS REPORT\nPeriod: ${dateRange.startDate} to ${dateRange.endDate}\n\n`
      reportData += `SUMMARY\n`
      Object.entries(movementsByType).forEach(([type, data]) => {
        reportData += `${type}: ${data.count} transactions, ${data.quantity} units\n`
      })
      reportData += `\n\nDETAILED MOVEMENTS\n`
      movementsInRange.forEach(mov => {
        reportData += `${new Date(mov.timestamp).toLocaleString()} - ${mov.type}: ${mov.quantity} units of ${mov.medicineId} - ${mov.reason}\n`
      })
      filename = `stock-movements-${dateRange.startDate}-to-${dateRange.endDate}.txt`
    } else if (reportType === 'expiry') {
      reportData = `EXPIRY ALERT REPORT\nGenerated: ${new Date().toLocaleString()}\n\n`
      reportData += `SUMMARY\n`
      Object.entries(expiryAnalysis).forEach(([status, data]) => {
        reportData += `${status}: ${data.count} batches, KES ${data.value.toLocaleString()}\n`
      })
      reportData += `\n\nDETAILED EXPIRY DATA\n`
      medicines.forEach(med => {
        if (med.batches) {
          med.batches.forEach(batch => {
            const status = getExpiryStatus(batch.expiryDate)
            if (status !== 'normal') {
              reportData += `${med.name} - Batch ${batch.batchNumber}: ${batch.quantity} units, Expires ${batch.expiryDate} (${status})\n`
            }
          })
        }
      })
      filename = `expiry-alerts-${new Date().toISOString().split('T')[0]}.txt`
    }

    const blob = new Blob([reportData], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Report Exported',
      description: `${filename} has been downloaded`,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Inventory Reports</h2>
          <p className="text-muted-foreground">
            Comprehensive inventory analytics and reports
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="valuation" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="valuation">Stock Valuation</TabsTrigger>
          <TabsTrigger value="movements">Stock Movements</TabsTrigger>
          <TabsTrigger value="expiry">Expiry Analysis</TabsTrigger>
          <TabsTrigger value="category">Category Analysis</TabsTrigger>
        </TabsList>

        {/* Stock Valuation */}
        <TabsContent value="valuation" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">KES {totalStockValue.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-2">{medicines.length} medicines</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Low Stock Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  KES {lowStockValue.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {medicines.filter(m => m.currentStock <= m.minStock).length} items
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Average Unit Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  KES {(totalStockValue / medicines.reduce((sum, m) => sum + m.currentStock, 0)).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">Per unit</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Stock Valuation by Medicine</CardTitle>
              <CardDescription>Sorted by value (highest first)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-3 mb-4">
                  <Button size="sm" onClick={() => handleExportReport('valuation')}>
                    <Download className="mr-2 h-4 w-4" />
                    Export Report
                  </Button>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr className="text-left">
                        <th className="p-2">Medicine</th>
                        <th className="p-2">Code</th>
                        <th className="p-2 text-right">Stock</th>
                        <th className="p-2 text-right">Unit Price</th>
                        <th className="p-2 text-right">Total Value</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...medicines]
                        .sort((a, b) => (b.currentStock * b.unitPrice) - (a.currentStock * a.unitPrice))
                        .map(med => {
                          const value = med.currentStock * med.unitPrice
                          const stockStatus = 
                            med.currentStock === 0 ? 'out' :
                            med.currentStock <= med.minStock ? 'low' : 'ok'
                          
                          return (
                            <tr key={med.id} className="border-b">
                              <td className="p-2">{med.name}</td>
                              <td className="p-2 text-sm text-muted-foreground">{med.code}</td>
                              <td className="p-2 text-right">{med.currentStock}</td>
                              <td className="p-2 text-right">KES {med.unitPrice}</td>
                              <td className="p-2 text-right font-semibold">KES {value.toLocaleString()}</td>
                              <td className="p-2">
                                {stockStatus === 'out' && <Badge className="bg-red-100 text-red-800">Out</Badge>}
                                {stockStatus === 'low' && <Badge className="bg-orange-100 text-orange-800">Low</Badge>}
                                {stockStatus === 'ok' && <Badge className="bg-green-100 text-green-800">OK</Badge>}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stock Movements */}
        <TabsContent value="movements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Movement Analysis</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="startDate">From:</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                      className="w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="endDate">To:</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                      className="w-auto"
                    />
                  </div>
                  <Button size="sm" onClick={() => handleExportReport('movements')}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                {Object.entries(movementsByType).map(([type, data]) => (
                  <Card key={type}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium capitalize">{type}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{data.count}</div>
                      <p className="text-xs text-muted-foreground">{data.quantity} units total</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr className="text-left">
                      <th className="p-2">Date & Time</th>
                      <th className="p-2">Type</th>
                      <th className="p-2">Medicine</th>
                      <th className="p-2 text-right">Quantity</th>
                      <th className="p-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementsInRange.map(mov => (
                      <tr key={mov.id} className="border-b">
                        <td className="p-2 text-sm">{new Date(mov.timestamp).toLocaleString()}</td>
                        <td className="p-2">
                          <Badge className={
                            mov.type === 'dispensing' ? 'bg-blue-100 text-blue-800' :
                            mov.type === 'adjustment' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }>
                            {mov.type}
                          </Badge>
                        </td>
                        <td className="p-2 text-sm">{medicines.find(m => m.id === mov.medicineId)?.name || mov.medicineId}</td>
                        <td className="p-2 text-right font-semibold">{mov.quantity}</td>
                        <td className="p-2 text-sm text-muted-foreground">{mov.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expiry Analysis */}
        <TabsContent value="expiry" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {Object.entries(expiryAnalysis).map(([status, data]) => (
              <Card key={status}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium capitalize">{status}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.count}</div>
                  <p className="text-xs text-muted-foreground">KES {data.value.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Expiry Details</CardTitle>
              <CardDescription>
                <Button size="sm" onClick={() => handleExportReport('expiry')} className="mt-2">
                  <Download className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                <div className="space-y-3">
                  {medicines.map(med => {
                    if (!med.batches || med.batches.length === 0) return null
                    
                    const alertBatches = med.batches.filter(b => getExpiryStatus(b.expiryDate) !== 'normal')
                    if (alertBatches.length === 0) return null

                    return (
                      <div key={med.id} className="border rounded-lg p-4">
                        <div className="font-semibold mb-2">{med.name} ({med.code})</div>
                        <div className="space-y-2">
                          {alertBatches.map(batch => {
                            const status = getExpiryStatus(batch.expiryDate)
                            return (
                              <div key={batch.batchNumber} className="flex items-center justify-between text-sm">
                                <div>
                                  <span className="font-medium">Batch {batch.batchNumber}</span>
                                  <span className="text-muted-foreground ml-2">• {batch.quantity} units</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-muted-foreground">Expires: {batch.expiryDate}</span>
                                  <Badge className={
                                    status === 'expired' ? 'bg-red-100 text-red-800' :
                                    status === 'critical' ? 'bg-orange-100 text-orange-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }>
                                    {status}
                                  </Badge>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Category Analysis */}
        <TabsContent value="category" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <CardDescription>Stock distribution by medicine category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(categoryBreakdown).map(([category, data]) => {
                  const percentage = (data.value / totalStockValue) * 100
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold capitalize">{category}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({data.count} items, {data.stock} units)
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">KES {data.value.toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

