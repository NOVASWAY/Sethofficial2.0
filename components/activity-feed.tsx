'use client'

import { useState, useEffect } from 'react'
import { Activity, Clock, User, FileText, Pill, Receipt, Calendar, FlaskConical, Stethoscope, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { activityLogAPI } from '@/lib/api-client'
import { formatDistanceToNow, format } from 'date-fns'

interface ActivityFeedProps {
  className?: string
  limit?: number
  showFilters?: boolean
  realtime?: boolean
}

interface ActivityLogEntry {
  id: string
  user_id: string
  user_name?: string
  user_role?: string
  action: string
  module: string
  entity_type?: string
  entity_id?: string
  description?: string
  details?: any
  ip_address?: string
  user_agent?: string
  created_at: string
}

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  create: FileText,
  update: FileText,
  delete: XCircle,
  view: FileText,
  login: User,
  logout: User,
  'create_patient': User,
  'create_consultation': Stethoscope,
  'create_prescription': Pill,
  'create_invoice': Receipt,
  'create_appointment': Calendar,
  'create_lab_order': FlaskConical,
  'create_lab_result': FlaskConical,
  'update_patient': User,
  'update_consultation': Stethoscope,
  'update_prescription': Pill,
  'update_invoice': Receipt,
  'update_appointment': Calendar,
  'update_lab_order': FlaskConical,
  'update_lab_result': FlaskConical,
  'delete_patient': User,
  'delete_consultation': Stethoscope,
  'delete_prescription': Pill,
  'delete_invoice': Receipt,
  'delete_appointment': Calendar,
  'delete_lab_order': FlaskConical,
  'delete_lab_result': FlaskConical,
  'pay_invoice': Receipt,
  'dispense_prescription': Pill,
  'verify_lab_result': FlaskConical,
  'review_lab_result': FlaskConical,
}

const ACTION_COLORS: Record<string, string> = {
  create: 'text-green-600',
  update: 'text-blue-600',
  delete: 'text-red-600',
  view: 'text-gray-600',
  login: 'text-green-600',
  logout: 'text-gray-600',
}

const MODULE_LABELS: Record<string, string> = {
  patients: 'Patient',
  consultations: 'Consultation',
  prescriptions: 'Prescription',
  invoices: 'Invoice',
  appointments: 'Appointment',
  lab_orders: 'Lab Order',
  lab_results: 'Lab Result',
  pharmacy: 'Pharmacy',
  billing: 'Billing',
  inventory: 'Inventory',
  users: 'User',
  settings: 'Settings',
  authentication: 'Authentication',
}

export function ActivityFeed({ 
  className, 
  limit = 50, 
  showFilters = true,
  realtime = true 
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'patients' | 'consultations' | 'prescriptions' | 'invoices' | 'lab'>('all')
  const { toast } = useToast()

  const loadActivities = async () => {
    setLoading(true)
    try {
      const response = await activityLogAPI.getRecent({
        limit,
      })
      
      if (response && Array.isArray(response)) {
        setActivities(response)
      } else if (response && response.data && Array.isArray(response.data)) {
        setActivities(response.data)
      }
    } catch (error) {
      console.error('Failed to load activities:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load activity feed',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadActivities()
    
    if (realtime) {
      // Poll for new activities every 30 seconds
      const interval = setInterval(loadActivities, 30000)
      return () => clearInterval(interval)
    }
  }, [filter, limit, realtime])

  const getActionIcon = (action: string, module: string) => {
    const key = `${action}_${module}`.toLowerCase()
    const Icon = ACTION_ICONS[key] || ACTION_ICONS[action] || Activity
    return Icon
  }

  const getActionColor = (action: string) => {
    return ACTION_COLORS[action.toLowerCase()] || 'text-gray-600'
  }

  const getModuleLabel = (module: string) => {
    return MODULE_LABELS[module] || module.charAt(0).toUpperCase() + module.slice(1)
  }

  const formatAction = (action: string, module: string, entityType?: string) => {
    const actionMap: Record<string, string> = {
      create: 'created',
      update: 'updated',
      delete: 'deleted',
      view: 'viewed',
      login: 'logged in',
      logout: 'logged out',
      pay_invoice: 'paid',
      dispense_prescription: 'dispensed',
      verify_lab_result: 'verified',
      review_lab_result: 'reviewed',
    }

    const actionText = actionMap[action.toLowerCase()] || action
    const entity = entityType || getModuleLabel(module)
    
    return `${actionText} ${entity}`
  }

  const groupedActivities = activities.reduce((acc, activity) => {
    const date = new Date(activity.created_at)
    const dateKey = format(date, 'yyyy-MM-dd')
    
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(activity)
    return acc
  }, {} as Record<string, ActivityLogEntry[]>)

  const getDateLabel = (dateKey: string) => {
    const date = new Date(dateKey)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return 'Today'
    } else if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return 'Yesterday'
    } else {
      return format(date, 'MMMM d, yyyy')
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Feed
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadActivities}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showFilters && (
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="patients">Patients</TabsTrigger>
              <TabsTrigger value="consultations">Consultations</TabsTrigger>
              <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="lab">Lab</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        <ScrollArea className="h-[600px]">
          {loading && activities.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading activities...
            </div>
          ) : activities.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No activities found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedActivities)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([dateKey, dayActivities]) => (
                  <div key={dateKey} className="space-y-3">
                    <div className="sticky top-0 bg-background z-10 py-2 border-b">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {getDateLabel(dateKey)}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {dayActivities.map((activity) => {
                        const Icon = getActionIcon(activity.action, activity.module)
                        const actionColor = getActionColor(activity.action)
                        const actionText = formatAction(
                          activity.action,
                          activity.module,
                          activity.entity_type
                        )

                        return (
                          <div
                            key={activity.id}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                          >
                            <div className={`mt-0.5 ${actionColor}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-sm">
                                    <span className="font-medium">
                                      {activity.user_name || 'Unknown User'}
                                    </span>
                                    {' '}
                                    <span className="text-muted-foreground">
                                      {actionText}
                                    </span>
                                  </p>
                                  {activity.description && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {activity.description}
                                    </p>
                                  )}
                                  {activity.details && typeof activity.details === 'object' && (
                                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                      {activity.details.patient_name && (
                                        <p>Patient: {activity.details.patient_name}</p>
                                      )}
                                      {activity.details.invoice_number && (
                                        <p>Invoice: {activity.details.invoice_number}</p>
                                      )}
                                      {activity.details.prescription_id && (
                                        <p>Prescription: {activity.details.prescription_id}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {activity.user_role && (
                                    <Badge variant="outline" className="text-xs">
                                      {activity.user_role}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

