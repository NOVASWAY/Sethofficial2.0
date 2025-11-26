'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  FlaskConical, Clock, CheckCircle2, AlertCircle, 
  Search, Filter, RefreshCw, Eye, FileText,
  ArrowUpDown, ArrowDown, ArrowUp
} from 'lucide-react'
import { labAPI, LabTestOrder } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface LabTestQueueProps {
  onSelectOrder?: (order: LabTestOrder) => void
}

export function LabTestQueue({ onSelectOrder }: LabTestQueueProps) {
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<LabTestOrder[]>([])
  const [filteredOrders, setFilteredOrders] = useState<LabTestOrder[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [testTypeFilter, setTestTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('priority')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    loadOrders()
    // Refresh every 30 seconds
    const interval = setInterval(loadOrders, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    filterAndSortOrders()
  }, [orders, searchTerm, priorityFilter, statusFilter, testTypeFilter, sortBy, sortOrder])

  const loadOrders = async () => {
    try {
      setLoading(true)
      const pendingOrders = await labAPI.getPendingOrders({ limit: 100 })
      const ordersArray = Array.isArray(pendingOrders) ? pendingOrders : []
      setOrders(ordersArray)
    } catch (error) {
      console.error('Error loading orders:', error)
      toast({
        title: 'Error',
        description: 'Failed to load lab test orders',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortOrders = () => {
    let filtered = [...orders]

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(order =>
        order.order_number.toLowerCase().includes(searchLower) ||
        order.test_name.toLowerCase().includes(searchLower) ||
        order.test_type.toLowerCase().includes(searchLower) ||
        order.patient_id.toLowerCase().includes(searchLower)
      )
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(order => order.priority === priorityFilter)
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter)
    }

    // Apply test type filter
    if (testTypeFilter !== 'all') {
      filtered = filtered.filter(order => order.test_type === testTypeFilter)
    }

    // Sort orders
    filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { stat: 1, urgent: 2, routine: 3 }
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4
        return sortOrder === 'asc' ? aPriority - bPriority : bPriority - aPriority
      } else {
        const aDate = new Date(a.ordered_at).getTime()
        const bDate = new Date(b.ordered_at).getTime()
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate
      }
    })

    setFilteredOrders(filtered)
  }

  const handleCollectSample = async (orderId: string) => {
    try {
      await labAPI.updateOrder(orderId, {
        status: 'collected',
        collected_at: new Date().toISOString(),
      })
      toast({
        title: 'Success',
        description: 'Sample collection recorded',
      })
      loadOrders()
    } catch (error) {
      console.error('Error updating order:', error)
      toast({
        title: 'Error',
        description: 'Failed to update order',
        variant: 'destructive',
      })
    }
  }

  const handleStartTest = async (orderId: string) => {
    try {
      await labAPI.updateOrder(orderId, {
        status: 'in_progress',
      })
      toast({
        title: 'Success',
        description: 'Test started',
      })
      loadOrders()
    } catch (error) {
      console.error('Error updating order:', error)
      toast({
        title: 'Error',
        description: 'Failed to update order',
        variant: 'destructive',
      })
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'stat':
        return <Badge variant="destructive">STAT</Badge>
      case 'urgent':
        return <Badge variant="default" className="bg-orange-500">URGENT</Badge>
      case 'routine':
        return <Badge variant="secondary">Routine</Badge>
      default:
        return <Badge variant="secondary">{priority}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      case 'collected':
        return <Badge variant="default" className="bg-blue-500">Collected</Badge>
      case 'in_progress':
        return <Badge variant="default" className="bg-yellow-500">In Progress</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTestTypes = () => {
    const types = new Set(orders.map(o => o.test_type).filter(Boolean))
    return Array.from(types).sort()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lab Test Queue</h1>
          <p className="text-muted-foreground">Manage pending lab test orders</p>
        </div>
        <Button variant="outline" onClick={loadOrders} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="stat">STAT</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="collected">Collected</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
              </SelectContent>
            </Select>
            <Select value={testTypeFilter} onValueChange={setTestTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Test Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {getTestTypes().map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (sortBy === 'priority') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                } else {
                  setSortBy('priority')
                  setSortOrder('asc')
                }
              }}
            >
              Priority {sortBy === 'priority' && (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (sortBy === 'date') {
                  setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                } else {
                  setSortBy('date')
                  setSortOrder('asc')
                }
              }}
            >
              Date {sortBy === 'date' && (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Orders ({filteredOrders.length})</CardTitle>
          <CardDescription>
            Orders awaiting sample collection or processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No orders found
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{order.order_number}</span>
                      {getPriorityBadge(order.priority)}
                      {getStatusBadge(order.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">{order.test_name}</span>
                      {order.test_type && (
                        <span className="ml-2">({order.test_type})</span>
                      )}
                    </div>
                    {order.clinical_indication && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {order.clinical_indication}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Ordered: {new Date(order.ordered_at).toLocaleString()}
                    </div>
                    {order.sample_type && (
                      <div className="text-xs text-muted-foreground">
                        Sample: {order.sample_type}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {order.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCollectSample(order.id)}
                      >
                        Collect Sample
                      </Button>
                    )}
                    {order.status === 'collected' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartTest(order.id)}
                      >
                        Start Test
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (onSelectOrder) {
                          onSelectOrder(order)
                        } else {
                          router.push(`/dashboard/lab/orders/${order.id}/enter-result`)
                        }
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Enter Result
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/lab/orders/${order.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

