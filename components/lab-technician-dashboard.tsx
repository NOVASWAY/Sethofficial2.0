'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  FlaskConical, Clock, CheckCircle2, AlertCircle, 
  TrendingUp, FileText, RefreshCw, Plus, Search,
  Filter, Download, Activity
} from 'lucide-react'
import { labAPI, LabTestOrder, LabTestResult } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface LabTechnicianDashboardProps {
  userId?: string
}

export function LabTechnicianDashboard({ userId }: LabTechnicianDashboardProps) {
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    pendingOrders: 0,
    completedToday: 0,
    verifiedToday: 0,
    urgentOrders: 0,
  })
  const [recentOrders, setRecentOrders] = useState<LabTestOrder[]>([])
  const [recentResults, setRecentResults] = useState<LabTestResult[]>([])

  useEffect(() => {
    loadDashboardData()
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load pending orders
      const pendingOrders = await labAPI.getPendingOrders({ limit: 50 })
      const ordersArray = Array.isArray(pendingOrders) ? pendingOrders : []
      
      // Load recent results
      const results = await labAPI.getResults({ limit: 10 })
      const resultsArray = Array.isArray(results) ? results : []
      
      // Calculate statistics
      const urgentCount = ordersArray.filter(o => o.priority === 'stat' || o.priority === 'urgent').length
      const today = new Date().toISOString().split('T')[0]
      const completedToday = resultsArray.filter(r => 
        r.result_date.startsWith(today) && r.status === 'verified'
      ).length
      const verifiedToday = resultsArray.filter(r => 
        r.verified_at?.startsWith(today)
      ).length

      setStats({
        pendingOrders: ordersArray.length,
        completedToday,
        verifiedToday,
        urgentOrders: urgentCount,
      })
      
      setRecentOrders(ordersArray.slice(0, 5))
      setRecentResults(resultsArray.slice(0, 5))
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
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
      case 'verified':
        return <Badge variant="default" className="bg-green-600">Verified</Badge>
      case 'reviewed':
        return <Badge variant="default" className="bg-purple-500">Reviewed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lab Technician Dashboard</h1>
          <p className="text-muted-foreground">Manage lab test orders and results</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadDashboardData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => router.push('/dashboard/lab/queue')}>
            <Plus className="h-4 w-4 mr-2" />
            View Queue
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingOrders}</div>
            <p className="text-xs text-muted-foreground">
              Tests awaiting processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedToday}</div>
            <p className="text-xs text-muted-foreground">
              Tests completed today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verifiedToday}</div>
            <p className="text-xs text-muted-foreground">
              Results verified today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent Orders</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.urgentOrders}</div>
            <p className="text-xs text-muted-foreground">
              Requires immediate attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Test Queue</TabsTrigger>
          <TabsTrigger value="recent">Recent Results</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Lab Test Orders</CardTitle>
              <CardDescription>
                Orders awaiting sample collection or processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending orders
                </div>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => router.push(`/dashboard/lab/orders/${order.id}`)}
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
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/lab/orders/${order.id}/enter-result`)
                        }}
                      >
                        Enter Result
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/dashboard/lab/queue')}
                  >
                    View All Orders
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Lab Test Results</CardTitle>
              <CardDescription>
                Recently completed and verified test results
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : recentResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent results
                </div>
              ) : (
                <div className="space-y-4">
                  {recentResults.map((result) => (
                    <div
                      key={result.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                      onClick={() => router.push(`/dashboard/lab/results/${result.id}`)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{result.result_number}</span>
                          {getStatusBadge(result.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">{result.test_name}</span>
                          {result.test_type && (
                            <span className="ml-2">({result.test_type})</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Result Date: {new Date(result.result_date).toLocaleString()}
                        </div>
                        {result.verified_at && (
                          <div className="text-xs text-muted-foreground">
                            Verified: {new Date(result.verified_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/lab/results/${result.id}`)
                        }}
                      >
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lab Statistics</CardTitle>
              <CardDescription>
                Overview of lab operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Pending Orders</span>
                    <span className="text-sm font-bold">{stats.pendingOrders}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Urgent Orders</span>
                    <span className="text-sm font-bold text-orange-600">{stats.urgentOrders}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completed Today</span>
                    <span className="text-sm font-bold">{stats.completedToday}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Verified Today</span>
                    <span className="text-sm font-bold">{stats.verifiedToday}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 inline mr-2" />
                    Performance metrics and trends will be displayed here
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

