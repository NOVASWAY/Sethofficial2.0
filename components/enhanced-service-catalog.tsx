'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, DollarSign, Activity, Beaker, Stethoscope, Pill, FileText, 
  Calculator, Shield, AlertCircle, Loader2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { serviceCatalogAPI } from '@/lib/api-client'

export interface Service {
  id: string
  name: string
  category: string
  description: string
  cash_price: number
  nhif_price: number
  sha_price: number
  is_active: boolean
  requires_prescription: boolean
}

interface ServiceCatalogProps {
  role?: string
  onServiceSelect?: (service: Service) => void
  showPricing?: boolean
  insuranceType?: 'NHIF' | 'SHA' | 'Cash'
  patientType?: 'adult' | 'child' | 'senior'
}

export function EnhancedServiceCatalog({ 
  role = 'admin', 
  onServiceSelect,
  showPricing = true,
  insuranceType = 'Cash',
  patientType = 'adult'
}: ServiceCatalogProps) {
  const { toast } = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [filteredServices, setFilteredServices] = useState<Service[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [pricingCache, setPricingCache] = useState<Record<string, number>>({})

  // Load services from API
  useEffect(() => {
    loadServices()
  }, [])

  // Filter services when search or category changes
  useEffect(() => {
    filterServices(searchTerm, categoryFilter)
  }, [services, searchTerm, categoryFilter])

  const loadServices = async () => {
    try {
      setIsLoading(true)
      const servicesData = await serviceCatalogAPI.getAll()
      setServices(servicesData)
      setFilteredServices(servicesData)
    } catch (error) {
      console.error('Failed to load services:', error)
      toast({
        variant: 'error',
        title: 'Failed to Load Services',
        description: 'Unable to load service catalog. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filterServices = (search: string, category: string) => {
    let filtered = services

    if (category !== 'all') {
      filtered = filtered.filter(s => s.category === category)
    }

    if (search) {
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
      )
    }

    setFilteredServices(filtered)
  }

  const getServicePrice = async (serviceId: string): Promise<number> => {
    // Check cache first
    if (pricingCache[serviceId]) {
      return pricingCache[serviceId]
    }

    try {
      const pricing = await serviceCatalogAPI.calculatePricing(serviceId, insuranceType, patientType)
      const price = pricing.price
      
      // Cache the result
      setPricingCache(prev => ({ ...prev, [serviceId]: price }))
      return price
    } catch (error) {
      console.error('Failed to get pricing:', error)
      // Fallback to cash price
      const service = services.find(s => s.id === serviceId)
      return service?.cash_price || 0
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

  const getInsuranceIcon = (type: string) => {
    switch (type) {
      case 'NHIF': return <Shield className="h-4 w-4" />
      case 'SHA': return <Shield className="h-4 w-4" />
      default: return <DollarSign className="h-4 w-4" />
    }
  }

  const getInsuranceColor = (type: string) => {
    switch (type) {
      case 'NHIF': return 'bg-green-100 text-green-800'
      case 'SHA': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleServiceSelect = (service: Service) => {
    if (onServiceSelect) {
      onServiceSelect(service)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading services...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Service Catalog</h2>
          <p className="text-muted-foreground">
            Dynamic pricing based on insurance and patient type
          </p>
        </div>
        {showPricing && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={getInsuranceColor(insuranceType)}>
              {getInsuranceIcon(insuranceType)}
              <span className="ml-1">{insuranceType}</span>
            </Badge>
            <Badge variant="outline">
              {patientType}
            </Badge>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search Services</CardTitle>
          <CardDescription>Find services by name or description</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search services..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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
          <TabsTrigger value="pharmacy">Pharmacy ({services.filter(s => s.category === 'pharmacy').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <ServiceTable
            services={filteredServices}
            onServiceSelect={handleServiceSelect}
            showPricing={showPricing}
            insuranceType={insuranceType}
            patientType={patientType}
            getCategoryIcon={getCategoryIcon}
            getCategoryColor={getCategoryColor}
            getServicePrice={getServicePrice}
            pricingCache={pricingCache}
          />
        </TabsContent>

        {['consultation', 'laboratory', 'pharmacy'].map(cat => (
          <TabsContent key={cat} value={cat} className="space-y-4">
            <ServiceTable
              services={services.filter(s => s.category === cat)}
              onServiceSelect={handleServiceSelect}
              showPricing={showPricing}
              insuranceType={insuranceType}
              patientType={patientType}
              getCategoryIcon={getCategoryIcon}
              getCategoryColor={getCategoryColor}
              getServicePrice={getServicePrice}
              pricingCache={pricingCache}
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Pricing Information */}
      {showPricing && (
        <Alert>
          <Calculator className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-semibold">Dynamic Pricing Information</p>
              <p className="text-sm">
                Prices are calculated automatically based on:
              </p>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li><strong>Insurance Type:</strong> {insuranceType} coverage rates</li>
                <li><strong>Patient Type:</strong> {patientType} pricing tiers</li>
                <li><strong>Service Category:</strong> Specialized pricing rules</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

interface ServiceTableProps {
  services: Service[]
  onServiceSelect?: (service: Service) => void
  showPricing: boolean
  insuranceType: string
  patientType: string
  getCategoryIcon: (category: string) => JSX.Element
  getCategoryColor: (category: string) => string
  getServicePrice: (serviceId: string) => Promise<number>
  pricingCache: Record<string, number>
}

function ServiceTable({ 
  services, 
  onServiceSelect, 
  showPricing, 
  insuranceType, 
  patientType,
  getCategoryIcon, 
  getCategoryColor,
  getServicePrice,
  pricingCache
}: ServiceTableProps) {
  const [loadingPrices, setLoadingPrices] = useState<Set<string>>(new Set())

  const handlePriceLoad = async (serviceId: string) => {
    if (pricingCache[serviceId]) return pricingCache[serviceId]
    
    setLoadingPrices(prev => new Set(prev).add(serviceId))
    try {
      const price = await getServicePrice(serviceId)
      return price
    } finally {
      setLoadingPrices(prev => {
        const newSet = new Set(prev)
        newSet.delete(serviceId)
        return newSet
      })
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              {showPricing && <TableHead className="text-right">Price ({insuranceType})</TableHead>}
              <TableHead className="text-right">Cash Price</TableHead>
              {onServiceSelect && <TableHead>Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onServiceSelect ? 6 : 5} className="text-center text-muted-foreground py-8">
                  No services found
                </TableCell>
              </TableRow>
            ) : (
              services.map((service) => (
                <ServiceRow
                  key={service.id}
                  service={service}
                  onServiceSelect={onServiceSelect}
                  showPricing={showPricing}
                  insuranceType={insuranceType}
                  getCategoryIcon={getCategoryIcon}
                  getCategoryColor={getCategoryColor}
                  pricingCache={pricingCache}
                  loadingPrices={loadingPrices}
                  onPriceLoad={handlePriceLoad}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

interface ServiceRowProps {
  service: Service
  onServiceSelect?: (service: Service) => void
  showPricing: boolean
  insuranceType: string
  getCategoryIcon: (category: string) => JSX.Element
  getCategoryColor: (category: string) => string
  pricingCache: Record<string, number>
  loadingPrices: Set<string>
  onPriceLoad: (serviceId: string) => Promise<number>
}

function ServiceRow({ 
  service, 
  onServiceSelect, 
  showPricing, 
  insuranceType,
  getCategoryIcon, 
  getCategoryColor,
  pricingCache,
  loadingPrices,
  onPriceLoad
}: ServiceRowProps) {
  const [dynamicPrice, setDynamicPrice] = useState<number | null>(null)

  useEffect(() => {
    if (showPricing && insuranceType !== 'Cash') {
      onPriceLoad(service.id).then(setDynamicPrice)
    }
  }, [service.id, showPricing, insuranceType, onPriceLoad])

  const isLoading = loadingPrices.has(service.id)
  const displayPrice = showPricing && insuranceType !== 'Cash' 
    ? (dynamicPrice || pricingCache[service.id] || 0)
    : service.cash_price

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {service.name}
          {service.requires_prescription && (
            <Badge variant="outline" className="text-xs">
              Rx Required
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={getCategoryColor(service.category)}>
          <span className="mr-1">{getCategoryIcon(service.category)}</span>
          {service.category}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
        {service.description}
      </TableCell>
      {showPricing && (
        <TableCell className="text-right">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : (
            <span className="font-semibold">
              KSh {displayPrice.toLocaleString()}
            </span>
          )}
        </TableCell>
      )}
      <TableCell className="text-right font-semibold">
        KSh {service.cash_price.toLocaleString()}
      </TableCell>
      {onServiceSelect && (
        <TableCell>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onServiceSelect(service)}
          >
            Select
          </Button>
        </TableCell>
      )}
    </TableRow>
  )
}
