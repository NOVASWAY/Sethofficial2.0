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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Edit2, Search, DollarSign, Activity, Beaker, Stethoscope, Pill, FileText } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { serviceCatalogAPI } from '@/lib/api-client'

export interface Service {
  id: string
  code: string
  name: string
  category: 'consultation' | 'laboratory' | 'procedure' | 'imaging' | 'pharmacy' | 'other'
  description: string
  price: number
  shaPrice?: number // SHA covered price (if different)
  isActive: boolean
  requiresDoctor: boolean
  createdAt: string
  updatedAt: string
}

// Predefined service catalog
export const defaultServices: Service[] = [
  // Consultations
  {
    id: '1',
    code: 'CONS-001',
    name: 'General Consultation',
    category: 'consultation',
    description: 'Standard doctor consultation',
    price: 1000,
    shaPrice: 800,
    isActive: true,
    requiresDoctor: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '2',
    code: 'CONS-002',
    name: 'Specialist Consultation',
    category: 'consultation',
    description: 'Specialist doctor consultation',
    price: 2000,
    shaPrice: 1500,
    isActive: true,
    requiresDoctor: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '3',
    code: 'CONS-003',
    name: 'Follow-up Visit',
    category: 'consultation',
    description: 'Follow-up consultation within 30 days',
    price: 500,
    shaPrice: 400,
    isActive: true,
    requiresDoctor: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  // Laboratory Tests
  {
    id: '4',
    code: 'LAB-001',
    name: 'Full Blood Count (FBC)',
    category: 'laboratory',
    description: 'Complete blood count test',
    price: 800,
    shaPrice: 600,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '5',
    code: 'LAB-002',
    name: 'Malaria Test',
    category: 'laboratory',
    description: 'Malaria rapid test',
    price: 300,
    shaPrice: 250,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '6',
    code: 'LAB-003',
    name: 'Blood Sugar Test',
    category: 'laboratory',
    description: 'Random blood glucose test',
    price: 200,
    shaPrice: 150,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '7',
    code: 'LAB-004',
    name: 'Urinalysis',
    category: 'laboratory',
    description: 'Complete urine analysis',
    price: 400,
    shaPrice: 300,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '8',
    code: 'LAB-005',
    name: 'Stool Test',
    category: 'laboratory',
    description: 'Stool examination',
    price: 500,
    shaPrice: 400,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '9',
    code: 'LAB-006',
    name: 'HIV Test',
    category: 'laboratory',
    description: 'HIV rapid test (Rapid diagnostic test)',
    price: 500,
    shaPrice: 0, // Often free or subsidized
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '10',
    code: 'LAB-007',
    name: 'Pregnancy Test',
    category: 'laboratory',
    description: 'Pregnancy rapid test',
    price: 300,
    shaPrice: 200,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  // Procedures
  {
    id: '11',
    code: 'PROC-001',
    name: 'Wound Dressing',
    category: 'procedure',
    description: 'Wound cleaning and dressing',
    price: 500,
    shaPrice: 400,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '12',
    code: 'PROC-002',
    name: 'Injection/IM',
    category: 'procedure',
    description: 'Intramuscular injection',
    price: 200,
    shaPrice: 150,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '13',
    code: 'PROC-003',
    name: 'IV Drip',
    category: 'procedure',
    description: 'Intravenous fluid administration',
    price: 1500,
    shaPrice: 1200,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '14',
    code: 'PROC-004',
    name: 'Suturing',
    category: 'procedure',
    description: 'Wound suturing',
    price: 2000,
    shaPrice: 1500,
    isActive: true,
    requiresDoctor: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '15',
    code: 'PROC-005',
    name: 'Nebulization',
    category: 'procedure',
    description: 'Nebulizer treatment',
    price: 500,
    shaPrice: 400,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  // Imaging
  {
    id: '16',
    code: 'IMG-001',
    name: 'X-Ray (Single View)',
    category: 'imaging',
    description: 'Single view X-ray',
    price: 1500,
    shaPrice: 1200,
    isActive: true,
    requiresDoctor: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '17',
    code: 'IMG-002',
    name: 'Ultrasound',
    category: 'imaging',
    description: 'General ultrasound scan',
    price: 2500,
    shaPrice: 2000,
    isActive: true,
    requiresDoctor: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  // Other Services
  {
    id: '18',
    code: 'OTHER-001',
    name: 'Medical Certificate',
    category: 'other',
    description: 'Medical fitness certificate',
    price: 500,
    shaPrice: 400,
    isActive: true,
    requiresDoctor: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  {
    id: '19',
    code: 'OTHER-002',
    name: 'Prescription Refill',
    category: 'other',
    description: 'Prescription renewal without consultation',
    price: 300,
    shaPrice: 200,
    isActive: true,
    requiresDoctor: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
]

interface ServiceCatalogProps {
  role?: string
}

export function ServiceCatalog({ role = 'admin' }: ServiceCatalogProps) {
  const { toast } = useToast()
  const [services, setServices] = useState<Service[]>(defaultServices)
  const [filteredServices, setFilteredServices] = useState<Service[]>(defaultServices)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingServices, setIsLoadingServices] = useState(false)

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'consultation' as Service['category'],
    description: '',
    price: '',
    shaPrice: '',
    requiresDoctor: false,
  })

  const canManageServices = role === 'admin'

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    filterServices(value, categoryFilter)
  }

  const handleCategoryFilter = (category: string) => {
    setCategoryFilter(category)
    filterServices(searchTerm, category)
  }

  const filterServices = (search: string, category: string) => {
    let filtered = services

    if (category !== 'all') {
      filtered = filtered.filter(s => s.category === category)
    }

    if (search) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
      )
    }

    setFilteredServices(filtered)
  }

  const handleAddService = () => {
    setFormData({
      code: '',
      name: '',
      category: 'consultation',
      description: '',
      price: '',
      shaPrice: '',
      requiresDoctor: false,
    })
    setIsAddDialogOpen(true)
  }

  const handleEditService = (service: Service) => {
    setSelectedService(service)
    setFormData({
      code: service.code,
      name: service.name,
      category: service.category,
      description: service.description,
      price: service.price.toString(),
      shaPrice: service.shaPrice?.toString() || '',
      requiresDoctor: service.requiresDoctor,
    })
    setIsEditDialogOpen(true)
  }

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!canManageServices) {
        toast({
          title: 'Permission Denied',
          description: 'Only admins can add services',
          variant: 'error',
        })
        setIsLoading(false)
        return
      }

      // Call API to create service
      const response = await serviceCatalogAPI.create({
        service_code: formData.code,
        service_name: formData.name,
        category: formData.category,
        description: formData.description || '',
        unit_price: parseFloat(formData.price),
        cash_price: parseFloat(formData.price),
        sha_price: formData.shaPrice ? parseFloat(formData.shaPrice) : undefined,
        sha_approved: false,
        requires_prescription: formData.requiresDoctor,
      })

      if (response.success) {
        // Reload services from API
        await loadServicesFromAPI()

        toast({
          title: 'Service Added',
          description: `${formData.name} has been added to the catalog`,
        })

        setIsAddDialogOpen(false)
        setFormData({
          code: '',
          name: '',
          category: 'consultation',
          description: '',
          price: '',
          shaPrice: '',
          requiresDoctor: false,
        })
      } else {
        throw new Error(response.error || 'Failed to create service')
      }
    } catch (error: any) {
      console.error('Error adding service:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to add service',
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
      if (!selectedService || !canManageServices) {
        toast({
          title: 'Permission Denied',
          description: 'Only admins can update services',
          variant: 'error',
        })
        setIsLoading(false)
        return
      }

      // Call API to update service prices
      const response = await serviceCatalogAPI.updatePrices(
        selectedService.id,
        parseFloat(formData.price),
        undefined, // nhif_price - can be added later
        formData.shaPrice ? parseFloat(formData.shaPrice) : undefined
      )

      if (response.success) {
        // Reload services from API
        await loadServicesFromAPI()

        toast({
          title: 'Service Updated',
          description: `${formData.name} has been updated`,
        })

        setIsEditDialogOpen(false)
      } else {
        throw new Error(response.error || 'Failed to update service')
      }
    } catch (error: any) {
      console.error('Error updating service:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to update service',
        variant: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load services from API
  const loadServicesFromAPI = async () => {
    if (!canManageServices) return

    try {
      setIsLoadingServices(true)
      const servicesArray = await serviceCatalogAPI.getAllForAdmin()
      
      if (servicesArray && Array.isArray(servicesArray) && servicesArray.length > 0) {
        // Transform API response to match Service interface
        const transformedServices: Service[] = servicesArray.map((s: any) => ({
          id: s.id,
          code: s.service_code,
          name: s.service_name,
          category: s.category,
          description: s.description || '',
          price: s.cash_price ? parseFloat(s.cash_price) : (s.unit_price ? parseFloat(s.unit_price) : 0),
          shaPrice: s.sha_price ? parseFloat(s.sha_price) : undefined,
          isActive: s.is_active !== undefined ? s.is_active : true,
          requiresDoctor: s.requires_prescription || false,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }))
        
        setServices(transformedServices)
        setFilteredServices(transformedServices)
      } else if (servicesArray && Array.isArray(servicesArray)) {
        // Empty array - no services yet, keep default services
        setServices(defaultServices)
        setFilteredServices(defaultServices)
      }
    } catch (error) {
      console.error('Error loading services:', error)
      // Fall back to default services on error
      setServices(defaultServices)
      setFilteredServices(defaultServices)
    } finally {
      setIsLoadingServices(false)
    }
  }

  // Load services on mount if admin
  useEffect(() => {
    if (canManageServices) {
      loadServicesFromAPI()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageServices])

  const getCategoryIcon = (category: Service['category']) => {
    switch (category) {
      case 'consultation': return <Stethoscope className="h-4 w-4" />
      case 'laboratory': return <Beaker className="h-4 w-4" />
      case 'procedure': return <Activity className="h-4 w-4" />
      case 'imaging': return <FileText className="h-4 w-4" />
      case 'pharmacy': return <Pill className="h-4 w-4" />
      default: return <DollarSign className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: Service['category']) => {
    switch (category) {
      case 'consultation': return 'bg-blue-100 text-blue-800'
      case 'laboratory': return 'bg-green-100 text-green-800'
      case 'procedure': return 'bg-purple-100 text-purple-800'
      case 'imaging': return 'bg-orange-100 text-orange-800'
      case 'pharmacy': return 'bg-pink-100 text-pink-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Service Catalog</h2>
          <p className="text-muted-foreground">
            Manage fixed prices for all clinic services
          </p>
        </div>
        {canManageServices && (
          <Button onClick={handleAddService}>
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Services</CardTitle>
          <CardDescription>Find services by name, code, or description</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
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
                <SelectItem value="consultation">Consultations</SelectItem>
                <SelectItem value="laboratory">Laboratory</SelectItem>
                <SelectItem value="procedure">Procedures</SelectItem>
                <SelectItem value="imaging">Imaging</SelectItem>
                <SelectItem value="pharmacy">Pharmacy</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Services by Category */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Services ({filteredServices.length})</TabsTrigger>
          <TabsTrigger value="consultation">Consultations ({services.filter(s => s.category === 'consultation').length})</TabsTrigger>
          <TabsTrigger value="laboratory">Laboratory ({services.filter(s => s.category === 'laboratory').length})</TabsTrigger>
          <TabsTrigger value="procedure">Procedures ({services.filter(s => s.category === 'procedure').length})</TabsTrigger>
          <TabsTrigger value="imaging">Imaging ({services.filter(s => s.category === 'imaging').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <ServiceTable
            services={filteredServices}
            onEdit={handleEditService}
            canManage={canManageServices}
            getCategoryIcon={getCategoryIcon}
            getCategoryColor={getCategoryColor}
          />
        </TabsContent>

        {['consultation', 'laboratory', 'procedure', 'imaging'].map(cat => (
          <TabsContent key={cat} value={cat} className="space-y-4">
            <ServiceTable
              services={services.filter(s => s.category === cat)}
              onEdit={handleEditService}
              canManage={canManageServices}
              getCategoryIcon={getCategoryIcon}
              getCategoryColor={getCategoryColor}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Add Service Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Service</DialogTitle>
            <DialogDescription>Create a new service with fixed pricing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Service Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., CONS-004"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value as Service['category'] })}
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
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Service Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Pediatric Consultation"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the service"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Cash Price (KSh) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="e.g., 1000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shaPrice">SHA Price (KSh)</Label>
                <Input
                  id="shaPrice"
                  type="number"
                  value={formData.shaPrice}
                  onChange={(e) => setFormData({ ...formData, shaPrice: e.target.value })}
                  placeholder="e.g., 800 (optional)"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requiresDoctor"
                checked={formData.requiresDoctor}
                onChange={(e) => setFormData({ ...formData, requiresDoctor: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="requiresDoctor" className="cursor-pointer">
                Requires Doctor Authorization
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Adding...' : 'Add Service'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Service Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Service</DialogTitle>
            <DialogDescription>Update service details and pricing</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-code">Service Code *</Label>
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
                  onValueChange={(value) => setFormData({ ...formData, category: value as Service['category'] })}
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
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">Service Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-price">Cash Price (KSh) *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-shaPrice">SHA Price (KSh)</Label>
                <Input
                  id="edit-shaPrice"
                  type="number"
                  value={formData.shaPrice}
                  onChange={(e) => setFormData({ ...formData, shaPrice: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-requiresDoctor"
                checked={formData.requiresDoctor}
                onChange={(e) => setFormData({ ...formData, requiresDoctor: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="edit-requiresDoctor" className="cursor-pointer">
                Requires Doctor Authorization
              </Label>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Service'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ServiceTableProps {
  services: Service[]
  onEdit: (service: Service) => void
  canManage: boolean
  getCategoryIcon: (category: Service['category']) => JSX.Element
  getCategoryColor: (category: Service['category']) => string
}

function ServiceTable({ services, onEdit, canManage, getCategoryIcon, getCategoryColor }: ServiceTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Service Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Cash Price</TableHead>
              <TableHead className="text-right">SHA Price</TableHead>
              {canManage && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No services found
                </TableCell>
              </TableRow>
            ) : (
              services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-mono text-sm">{service.code}</TableCell>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getCategoryColor(service.category)}>
                      <span className="mr-1">{getCategoryIcon(service.category)}</span>
                      {service.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {service.description}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    KSh {service.price.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {service.shaPrice ? (
                      <span className="text-blue-600 font-semibold">KSh {service.shaPrice.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(service)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

