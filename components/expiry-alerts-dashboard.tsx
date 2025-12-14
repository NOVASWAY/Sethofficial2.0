'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Clock, XCircle, Package } from 'lucide-react'
import { useInventory } from '@/contexts/inventory-context'
import { getAllExpiryAlerts, formatExpiryStatus, type ExpiryAlert } from '@/lib/expiry-utils'
import { Skeleton } from '@/components/ui/skeleton'

function ExpiryAlertsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="border-gray-200">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-16 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ExpiryAlertsDashboard() {
  const { medicines } = useInventory()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted && medicines.length === 0) {
    return <ExpiryAlertsSkeleton />
  }

  const allAlerts = getAllExpiryAlerts(medicines)

  const expiredAlerts = allAlerts.filter(a => a.severity === 'expired')
  const criticalAlerts = allAlerts.filter(a => a.severity === 'critical')
  const warningAlerts = allAlerts.filter(a => a.severity === 'warning')

  const getSeverityIcon = (severity: ExpiryAlert['severity']) => {
    switch (severity) {
      case 'expired':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'warning':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  const renderAlertTable = (alerts: ExpiryAlert[]) => {
    if (alerts.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No alerts in this category</p>
        </div>
      )
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Medicine</TableHead>
            <TableHead>Batch Number</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alerts.map((alert, idx) => {
            const status = formatExpiryStatus(alert.expiryDate)
            return (
              <TableRow key={`${alert.medicineId}-${alert.batchNumber}-${idx}`}>
                <TableCell className="font-medium">{alert.medicineName}</TableCell>
                <TableCell>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{alert.batchNumber}</code>
                </TableCell>
                <TableCell>{alert.quantity} units</TableCell>
                <TableCell>{new Date(alert.expiryDate).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={status.bgColor}>
                    <span className="flex items-center gap-1">
                      {getSeverityIcon(alert.severity)}
                      <span className={status.color}>{status.text}</span>
                    </span>
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Expiry Alerts</h2>
        <p className="text-muted-foreground">
          Monitor medicines approaching expiry date
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{expiredAlerts.length}</div>
            <p className="text-xs text-red-600 mt-1">Immediate action required</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Critical (≤30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700">{criticalAlerts.length}</div>
            <p className="text-xs text-orange-600 mt-1">Urgent attention needed</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              Warning (≤90 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-700">{warningAlerts.length}</div>
            <p className="text-xs text-yellow-600 mt-1">Plan for replacement</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Priority Alert */}
      {expiredAlerts.length > 0 && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription>
            <div className="font-bold text-red-900 text-lg mb-2">
              ⚠️ EXPIRED MEDICINES DETECTED - {expiredAlerts.length}
            </div>
            <div className="text-red-800">
              You have <span className="font-semibold">{expiredAlerts.length}</span> expired medicine batch(es).
              These must be removed from inventory immediately and disposed of properly.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Tables */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Expiry Alerts</CardTitle>
          <CardDescription>
            Review all medicines by expiry status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="expired" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="expired" className="data-[state=active]:bg-red-100">
                <XCircle className="h-4 w-4 mr-2" />
                Expired ({expiredAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="critical" className="data-[state=active]:bg-orange-100">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Critical ({criticalAlerts.length})
              </TabsTrigger>
              <TabsTrigger value="warning" className="data-[state=active]:bg-yellow-100">
                <Clock className="h-4 w-4 mr-2" />
                Warning ({warningAlerts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="expired" className="mt-4">
              {renderAlertTable(expiredAlerts)}
            </TabsContent>

            <TabsContent value="critical" className="mt-4">
              {renderAlertTable(criticalAlerts)}
            </TabsContent>

            <TabsContent value="warning" className="mt-4">
              {renderAlertTable(warningAlerts)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Actions & Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <div className="font-semibold text-red-900">Expired Medicines</div>
              <div className="text-sm text-muted-foreground">
                Remove from shelves immediately, quarantine, and dispose according to regulations
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div>
              <div className="font-semibold text-orange-900">Critical (≤30 days)</div>
              <div className="text-sm text-muted-foreground">
                Prioritize dispensing these batches first (FEFO - First Expiry First Out)
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <div className="font-semibold text-yellow-900">Warning (≤90 days)</div>
              <div className="text-sm text-muted-foreground">
                Monitor closely and plan procurement of replacement stock
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ExpiryAlertsDashboard
