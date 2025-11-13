'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useDebounce } from '@/hooks/use-debounce'
import { Search, Download, Filter, Calendar, User, Activity } from 'lucide-react'
import { apiCall } from '@/lib/api-client'

interface AuditLog {
  id: string
  user_id: string
  username: string
  action: string
  resource_type: string
  resource_id: string
  details: Record<string, any>
  ip_address: string
  user_agent: string
  created_at: string
}

interface AuditLogViewerProps {
  className?: string
}

export function AuditLogViewer({ className }: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  useEffect(() => {
    loadAuditLogs()
  }, [debouncedSearchTerm, actionFilter, resourceTypeFilter, dateFrom, dateTo, page])

  const loadAuditLogs = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      })

      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm)
      }
      if (actionFilter !== 'all') {
        params.append('action', actionFilter)
      }
      if (resourceTypeFilter !== 'all') {
        params.append('resource_type', resourceTypeFilter)
      }
      if (dateFrom) {
        params.append('date_from', dateFrom)
      }
      if (dateTo) {
        params.append('date_to', dateTo)
      }

      const response = await apiCall<{
        success: boolean
        data: AuditLog[]
        pagination: {
          page: number
          limit: number
          total: number
          total_pages: number
        }
      }>(`/audit-logs?${params.toString()}`)

      if (response.success && response.data) {
        setLogs(response.data)
        if (response.pagination) {
          setTotalPages(response.pagination.total_pages)
          setTotal(response.pagination.total)
        }
      } else {
        setError('Failed to load audit logs')
      }
    } catch (error: any) {
      console.error('Error loading audit logs:', error)
      setError(error?.message || 'Failed to load audit logs')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        format: 'csv',
      })

      if (debouncedSearchTerm) params.append('search', debouncedSearchTerm)
      if (actionFilter !== 'all') params.append('action', actionFilter)
      if (resourceTypeFilter !== 'all') params.append('resource_type', resourceTypeFilter)
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)

      const response = await fetch(`http://localhost:8080/api/v1/audit-logs/export?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  const filteredLogs = useMemo(() => {
    return logs // Already filtered by API
  }, [logs])

  const actionTypes = useMemo(() => {
    const actions = new Set<string>()
    logs.forEach(log => actions.add(log.action))
    return Array.from(actions).sort()
  }, [logs])

  const resourceTypes = useMemo(() => {
    const types = new Set<string>()
    logs.forEach(log => types.add(log.resource_type))
    return Array.from(types).sort()
  }, [logs])

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('create') || action.includes('add')) return 'default'
    if (action.includes('update') || action.includes('edit')) return 'secondary'
    if (action.includes('delete') || action.includes('remove')) return 'destructive'
    if (action.includes('login') || action.includes('auth')) return 'outline'
    return 'default'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Audit Log Viewer
              </CardTitle>
              <CardDescription>
                View and search system audit logs ({total} total)
              </CardDescription>
            </div>
            <Button onClick={handleExport} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actionTypes.map(action => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Resource Type</Label>
              <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {resourceTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="From"
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="To"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Logs Table */}
          <div className="border rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left text-sm font-medium">Timestamp</th>
                    <th className="p-3 text-left text-sm font-medium">User</th>
                    <th className="p-3 text-left text-sm font-medium">Action</th>
                    <th className="p-3 text-left text-sm font-medium">Resource</th>
                    <th className="p-3 text-left text-sm font-medium">Details</th>
                    <th className="p-3 text-left text-sm font-medium">IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Loading audit logs...
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No audit logs found
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {formatDate(log.created_at)}
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            {log.username}
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {log.action}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm">
                          <span className="font-mono text-xs">{log.resource_type}</span>
                          {log.resource_id && (
                            <span className="text-muted-foreground ml-1">({log.resource_id.slice(0, 8)}...)</span>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          <details className="cursor-pointer">
                            <summary className="text-xs text-muted-foreground">View Details</summary>
                            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        </td>
                        <td className="p-3 text-sm font-mono text-xs">
                          {log.ip_address}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

