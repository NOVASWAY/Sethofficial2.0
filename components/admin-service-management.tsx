'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Settings, Edit2, Plus, Save, X, DollarSign, Shield,
  Stethoscope, Beaker, Activity, FileText, Pill, Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { serviceCatalogAPI } from '@/lib/api-client'

interface Service {
  id: string
  name: string
  category: string
  description: string
  cash_price: number
  nhif_price: number
  sha_price: number
  is_active: boolean
  requires_prescription: boolean
  created_at: string
  updated_at: string
}

interface AdminServiceManagementProps {
  role?: string
}

export function AdminServiceManagement({ role = 'admin' }: AdminServiceManagementProps) {
  const { toast } = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editForm, setEditForm] = useState({
    cash_price: '',
    nhif_price: '',
    sha_price: '',
  })

  const [createForm, setCreateForm] = useState({
    service_id: '',
    name: '',
    category: 'consultation',
    description: '',
    cash_price: '',
    nhif_price: '',
    sha_price: '',
    requires_prescription: false,
  })

  // Check if user is admin
  const isAdmin = role === 'admin'

  useEffect(() => {
    if (isAdmin) {
      loadServices()
    }
  }, [isAdmin])

  const loadServices = async () => {
    try {
      setLoading(true)
      const servicesData = await serviceCatalogAPI.getAllForAdmin()
      setServices(servicesData)
    } catch (error) {
      console.error('Failed to load services:', error)
      toast({
        variant: 'error',
        title: 'Failed to Load Services',
        description: 'Unable to load services for management. Please try again.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditService = (service: Service) => {
    setEditingService(service)
    setEditForm({
      cash_price: service.cash_price.toString(),
      nhif_price: service.nhif_price.toString(),
      sha_price: service.sha_price.toString(),
    })
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingService) return

    try {
      setSaving(true)
      await serviceCatalogAPI.updatePrices(
        editingService.id,
        parseFloat(editForm.cash_price),
        parseFloat(editForm.nhif_price),
        parseFloat(editForm.sha_price)
      )

      // Update local state
      setServices(prev => prev.map(service =>
        service.id === editingService.id
          ? {
            ...service,
            cash_price: parseFloat(editForm.cash_price),
            nhif_price: parseFloat(editForm.nhif_price),
            sha_price: parseFloat(editForm.sha_price),
            updated_at: new Date().toISOString()
          }
          : service
      ))

      toast({
        title: 'Prices Updated',
        description: `Service prices for ${editingService.name} have been updated`,
      })

      setIsEditDialogOpen(false)
      setEditingService(null)
    } catch (error) {
      console.error('Failed to update prices:', error)
      toast({
        variant: 'error',
        title: 'Update Failed',
        description: 'Unable to update service prices. Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateService = async () => {
    try {
      setSaving(true)
      await serviceCatalogAPI.create({
        service_code: createForm.service_id,
        service_name: createForm.name,
        category: createForm.category,
        description: createForm.description,
        unit_price: parseFloat(createForm.cash_price || createForm.nhif_price || createForm.sha_price || '0') || 0,
        cash_price: parseFloat(createForm.cash_price),
        nhif_price: parseFloat(createForm.nhif_price),
        sha_price: parseFloat(createForm.sha_price),
        requires_prescription: createForm.requires_prescription,
      })

      toast({
        title: 'Service Created',
        description: `New service ${createForm.name} has been created`,
      })

      // Reset form and reload services
      setCreateForm({
        service_id: '',
        name: '',
        category: 'consultation',
        description: '',
        cash_price: '',
        nhif_price: '',
        sha_price: '',
        requires_prescription: false,
      })
      setIsCreateDialogOpen(false)
      loadServices()
    } catch (error) {
      console.error('Failed to create service:', error)
      toast({
        variant: 'error',
        title: 'Creation Failed',
        description: 'Unable to create new service. Please try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'consultation': return <Stethoscope className="h-4 w-4" />
      case 'laboratory': return <Beaker className="h-4 w-4" />
      case 'procedure': return <Activity className="h-4 w-4" />
      case 'imaging': return <FileText className="h-4 w-4" />
      case 'pharmacy': return <Pill className="h-4 w-4" />
      default: return <DollarSign className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'consultation': return 'bg-blue-100 text-blue-800'
      case 'laboratory': return 'bg-green-100 text-green-800'
      case 'procedure': return 'bg-purple-100 text-purple-800'
      case 'imaging': return 'bg-orange-100 text-orange-800'
      case 'pharmacy': return 'bg-pink-100 text-pink-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!isAdmin) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Access denied. This feature is only available to administrators.
        </AlertDescription>
      </Alert>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading services...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Service Price Management</h2>
          <p className="text-muted-foreground">
            Admin control panel for setting and managing service prices
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </Button>
      </div>

      <Alert>
        <Settings className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-1">
            <p className="font-semibold">Admin Price Control</p>
            <p className="text-sm">
              As an administrator, you can set and modify all service prices.
              Changes will immediately affect billing calculations across the system.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Service Pricing</CardTitle>
          <CardDescription>
            Manage prices for all clinic services. Set different rates for Cash, NHIF, and SHA insurance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Cash Price</TableHead>
                <TableHead className="text-right">NHIF Price</TableHead>
                <TableHead className="text-right">SHA Price</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{service.name}</div>
                      <div className="text-sm text-muted-foreground">{service.description}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {service.id}
                        {service.requires_prescription && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Rx Required
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getCategoryColor(service.category)}>
                      <span className="mr-1">{getCategoryIcon(service.category)}</span>
                      {service.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    KSh {service.cash_price.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-green-600 font-semibold">
                      KSh {service.nhif_price.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-blue-600 font-semibold">
                      KSh {service.sha_price.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditService(service)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Service Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Service Prices</DialogTitle>
            <DialogDescription>
              Update pricing for {editingService?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cash_price">Cash Price (KSh) *</Label>
                <Input
                  id="cash_price"
                  type="number"
                  step="0.01"
                  value={editForm.cash_price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, cash_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nhif_price">NHIF Price (KSh) *</Label>
                <Input
                  id="nhif_price"
                  type="number"
                  step="0.01"
                  value={editForm.nhif_price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, nhif_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sha_price">SHA Price (KSh) *</Label>
                <Input
                  id="sha_price"
                  type="number"
                  step="0.01"
                  value={editForm.sha_price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, sha_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-semibold">Pricing Guidelines</p>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    <li><strong>Cash Price:</strong> Full price for cash payments</li>
                    <li><strong>NHIF Price:</strong> Reduced price for NHIF insurance</li>
                    <li><strong>SHA Price:</strong> Reduced price for SHA insurance</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Service Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Service</DialogTitle>
            <DialogDescription>
              Add a new service to the clinic catalog
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service_id">Service ID *</Label>
                <Input
                  id="service_id"
                  value={createForm.service_id}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, service_id: e.target.value }))}
                  placeholder="e.g., CONS_NEW_001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={createForm.category}
                  onValueChange={(value) => setCreateForm(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="laboratory">Laboratory</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="imaging">Imaging</SelectItem>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., New Consultation Service"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the service"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create_cash_price">Cash Price (KSh) *</Label>
                <Input
                  id="create_cash_price"
                  type="number"
                  step="0.01"
                  value={createForm.cash_price}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, cash_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_nhif_price">NHIF Price (KSh) *</Label>
                <Input
                  id="create_nhif_price"
                  type="number"
                  step="0.01"
                  value={createForm.nhif_price}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, nhif_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_sha_price">SHA Price (KSh) *</Label>
                <Input
                  id="create_sha_price"
                  type="number"
                  step="0.01"
                  value={createForm.sha_price}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, sha_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requires_prescription"
                checked={createForm.requires_prescription}
                onChange={(e) => setCreateForm(prev => ({ ...prev, requires_prescription: e.target.checked }))}
                className="h-4 w-4"
              />
              <Label htmlFor="requires_prescription" className="cursor-pointer">
                Requires Prescription
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleCreateService}
                disabled={saving || !createForm.service_id || !createForm.name || !createForm.cash_price}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Service
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminServiceManagement
