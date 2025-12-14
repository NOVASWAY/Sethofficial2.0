'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Pill, Search, Filter, CheckCircle2, Clock, AlertTriangle,
  Eye, Package, Calendar, User
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from "@/contexts/auth-context"
import { activityLogAPI } from "@/lib/api-client"
import { prescriptionAPI } from '@/lib/api-client'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export function PrescriptionQueue() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedPrescription, setSelectedPrescription] = useState<any | null>(null)
  const [isDispenseDialogOpen, setIsDispenseDialogOpen] = useState(false)
  const [dispenseNotes, setDispenseNotes] = useState('')
  const [batchNumber, setBatchNumber] = useState('')

  useEffect(() => {
    loadPrescriptions()
  }, [statusFilter])

  const loadPrescriptions = async () => {
    setLoading(true)
    try {
      const params: any = { per_page: 100 }
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      const response = await prescriptionAPI.getAll(params)
      const prescriptionsList = response?.data || []

      // Sort by created date (newest first)
      prescriptionsList.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || a.date || 0)
        const dateB = new Date(b.created_at || b.date || 0)
        return dateB.getTime() - dateA.getTime()
      })

      setPrescriptions(prescriptionsList)
    } catch (error) {
      console.error('Error loading prescriptions:', error)
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Failed to load prescriptions',
      })
      setPrescriptions([])
    } finally {
      setLoading(false)
    }
  }

  const handleDispense = async () => {
    if (!selectedPrescription) return

    try {
      await prescriptionAPI.update(selectedPrescription.id, {
        status: 'dispensed',
        dispensed_at: new Date().toISOString(),
        batch_number: batchNumber || undefined,
        dispensing_notes: dispenseNotes || undefined,
      })

      // Log prescription dispensing activity
      if (user?.id) {
        try {
          await activityLogAPI.log({
            action: 'dispense_prescription',
            module: 'pharmacy',
            entity_type: 'prescription',
            entity_id: selectedPrescription.id,
            details: {
              prescription_number: selectedPrescription.prescription_number || selectedPrescription.id,
              patient_id: selectedPrescription.patient_id,
              medication_name: selectedPrescription.medication_name || selectedPrescription.medicationName,
              quantity: selectedPrescription.quantity,
              batch_number: batchNumber || null
            }
          })
        } catch (error) {
          console.warn('Failed to log activity:', error)
        }
      }

      toast({
        title: 'Prescription Dispensed',
        description: `Prescription ${selectedPrescription.prescription_number || selectedPrescription.id} has been dispensed.`,
      })

      setIsDispenseDialogOpen(false)
      setSelectedPrescription(null)
      setDispenseNotes('')
      setBatchNumber('')
      loadPrescriptions()
    } catch (error) {
      console.error('Error dispensing prescription:', error)
      toast({
        variant: 'error',
        title: 'Error',
        description: 'Failed to dispense prescription',
      })
    }
  }

  const filteredPrescriptions = prescriptions.filter((prescription: any) => {
    const matchesSearch = searchTerm === '' ||
      prescription.prescription_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prescription.patient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prescription.medication_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prescription.medicationName?.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  const pendingCount = prescriptions.filter((p: any) => p.status === 'pending' || p.status === 'active').length
  const dispensedCount = prescriptions.filter((p: any) => p.status === 'dispensed' || p.status === 'completed').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Prescription Queue</h1>
          <p className="text-muted-foreground">Manage and dispense patient prescriptions</p>
        </div>
        <Button onClick={loadPrescriptions} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prescriptions</CardTitle>
            <Pill className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prescriptions.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispensed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dispensedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by prescription number, patient, or medication..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="dispensed">Dispensed</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Prescriptions List */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-4 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading prescriptions...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredPrescriptions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground">No prescriptions found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredPrescriptions.map((prescription: any) => {
            const isPending = prescription.status === 'pending' || prescription.status === 'active'
            const isLowStock = prescription.available_stock !== undefined && prescription.available_stock < (prescription.quantity || 0)

            return (
              <Card
                key={prescription.id}
                className={`border-l-4 ${isPending ? 'border-l-orange-500' : 'border-l-green-500'}`}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">
                          {prescription.prescription_number || prescription.id}
                        </Badge>
                        <Badge variant={isPending ? 'secondary' : 'default'}>
                          {prescription.status || 'pending'}
                        </Badge>
                        {isLowStock && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Low Stock
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {new Date(prescription.created_at || prescription.date).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="font-medium">
                          {prescription.medication_name || prescription.medicationName || 'Unknown medication'}
                        </p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {prescription.patient_name || 'Unknown patient'}
                          </span>
                          {prescription.dosage && (
                            <span>{prescription.dosage} - {prescription.frequency}</span>
                          )}
                          {prescription.quantity && (
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              Qty: {prescription.quantity}
                            </span>
                          )}
                        </div>
                        {prescription.instructions && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {prescription.instructions}
                          </p>
                        )}
                        {prescription.clinician_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Prescribed by: {prescription.clinician_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedPrescription(prescription)
                          setIsDispenseDialogOpen(true)
                        }}
                        disabled={!isPending}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      {isPending && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPrescription(prescription)
                            setIsDispenseDialogOpen(true)
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Dispense
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Dispense Dialog */}
      <Dialog open={isDispenseDialogOpen} onOpenChange={setIsDispenseDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dispense Prescription</DialogTitle>
            <DialogDescription>
              Review and dispense prescription {selectedPrescription?.prescription_number || selectedPrescription?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedPrescription && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Patient</Label>
                  <p className="font-medium">{selectedPrescription.patient_name || 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Medication</Label>
                  <p className="font-medium">
                    {selectedPrescription.medication_name || selectedPrescription.medicationName}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Dosage</Label>
                  <p className="font-medium">
                    {selectedPrescription.dosage} - {selectedPrescription.frequency}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="font-medium">{selectedPrescription.quantity}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch_number">Batch Number (Optional)</Label>
                <Input
                  id="batch_number"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="Enter batch number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dispense_notes">Dispensing Notes (Optional)</Label>
                <Textarea
                  id="dispense_notes"
                  value={dispenseNotes}
                  onChange={(e) => setDispenseNotes(e.target.value)}
                  placeholder="Add any notes about this dispensing..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDispenseDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleDispense}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm Dispense
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

