'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Shield, Search, Download, Filter, Clock, User, Activity,
  AlertTriangle, Info, XCircle, AlertOctagon
} from 'lucide-react'
import { useAuditLog, type AuditLog } from '@/contexts/audit-log-context'
import { useToast } from '@/hooks/use-toast'

export function AuditLogs() {
  const { toast } = useToast()
  const { logs } = useAuditLog()
  
  const [filters, setFilters] = useState({
    searchTerm: '',
    module: 'all',
    severity: 'all',
    startDate: '',
    endDate: '',
  })

  const filteredLogs = logs.filter(log => {
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase()
      if (!log.details.toLowerCase().includes(term) && 
          !log.userName.toLowerCase().includes(term) &&
          !log.action.toLowerCase().includes(term)) {
        return false
      }
    }
    if (filters.module !== 'all' && log.module !== filters.module) return false
    if (filters.severity !== 'all' && log.severity !== filters.severity) return false
    if (filters.startDate && new Date(log.timestamp) < new Date(filters.startDate)) return false
    if (filters.endDate && new Date(log.timestamp) > new Date(filters.endDate)) return false
    return true
  })

  const getSeverityBadge = (severity: AuditLog['severity']) => {
    const styles = {
      info: { bg: 'bg-blue-100 text-blue-800', icon: Info },
      warning: { bg: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
      error: { bg: 'bg-orange-100 text-orange-800', icon: XCircle },
      critical: { bg: 'bg-red-100 text-red-800', icon: AlertOctagon },
    }
    const { bg, icon: Icon } = styles[severity]
    return (
      <Badge className={bg}>
        <Icon className="h-3 w-3 mr-1" />
        {severity.toUpperCase()}
      </Badge>
    )
  }

  const handleExport = () => {
    let reportData = `AUDIT LOG REPORT\nGenerated: ${new Date().toLocaleString()}\n`
    reportData += `Total Logs: ${filteredLogs.length}\n\n`
    
    if (filters.startDate || filters.endDate) {
      reportData += `Date Range: ${filters.startDate || 'N/A'} to ${filters.endDate || 'N/A'}\n`
    }
    if (filters.module !== 'all') reportData += `Module: ${filters.module}\n`
    if (filters.severity !== 'all') reportData += `Severity: ${filters.severity}\n`
    
    reportData += `\n${'='.repeat(100)}\n\n`

    filteredLogs.forEach(log => {
      reportData += `[${new Date(log.timestamp).toLocaleString()}] ${log.severity.toUpperCase()}\n`
      reportData += `User: ${log.userName} (${log.userRole})\n`
      reportData += `Module: ${log.module} | Action: ${log.action}\n`
      reportData += `Entity: ${log.entityType} (${log.entityId})\n`
      reportData += `Details: ${log.details}\n`
      reportData += `${'-'.repeat(100)}\n\n`
    })

    const blob = new Blob([reportData], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-log-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({
      title: 'Audit Log Exported',
      description: 'The audit log has been downloaded',
    })
  }

  const modules = ['all', ...Array.from(new Set(logs.map(log => log.module)))]
  const severities = ['all', 'info', 'warning', 'error', 'critical']

  // Statistics
  const stats = {
    total: logs.length,
    today: logs.filter(log => {
      const logDate = new Date(log.timestamp).toDateString()
      const today = new Date().toDateString()
      return logDate === today
    }).length,
    critical: logs.filter(log => log.severity === 'critical').length,
    byModule: logs.reduce((acc, log) => {
      acc[log.module] = (acc[log.module] || 0) + 1
      return acc
    }, {} as Record<string, number>),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">
            System activity audit trail for compliance and security
          </p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-2">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.today}</div>
            <p className="text-xs text-muted-foreground mt-2">Events today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-muted-foreground mt-2">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Most Active Module</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold capitalize">
              {Object.entries(stats.byModule).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {Object.entries(stats.byModule).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search logs..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <Select
                value={filters.module}
                onValueChange={(value) => setFilters({ ...filters, module: value })}
              >
                <SelectTrigger id="module">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {modules.map(module => (
                    <SelectItem key={module} value={module} className="capitalize">
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={filters.severity}
                onValueChange={(value) => setFilters({ ...filters, severity: value })}
              >
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {severities.map(severity => (
                    <SelectItem key={severity} value={severity} className="capitalize">
                      {severity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ searchTerm: '', module: 'all', severity: 'all', startDate: '', endDate: '' })}
            >
              Clear Filters
            </Button>
            <span className="text-sm text-muted-foreground">
              Showing {filteredLogs.length} of {logs.length} logs
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[600px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No audit logs match your filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map(log => (
                  <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(log.timestamp).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toRelativeTime?.() || 'Recently'}
                          </p>
                        </div>
                      </div>
                      {getSeverityBadge(log.severity)}
                    </div>

                    <div className="ml-7 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          <span className="font-medium">{log.userName}</span>
                          <span className="text-muted-foreground"> ({log.userRole})</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Activity className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          <Badge variant="outline" className="mr-2">{log.module}</Badge>
                          <span className="font-medium">{log.action}</span>
                        </span>
                      </div>

                      <p className="text-sm">{log.details}</p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Entity: {log.entityType} ({log.entityId})</span>
                        {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

