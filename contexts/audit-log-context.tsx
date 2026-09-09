'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@/contexts/auth-context'

export interface AuditLog {
  id: string
  timestamp: string
  userId: string
  userName: string
  userRole: string
  action: string
  module: string
  entityType: string
  entityId: string
  details: string
  ipAddress?: string
  severity: 'info' | 'warning' | 'error' | 'critical'
}

interface AuditLogContextType {
  logs: AuditLog[]
  logAction: (action: string, module: string, entityType: string, entityId: string, details: string, severity?: AuditLog['severity']) => void
  getLogsByUser: (userId: string) => AuditLog[]
  getLogsByModule: (module: string) => AuditLog[]
  getLogsByDateRange: (startDate: string, endDate: string) => AuditLog[]
}

const AuditLogContext = createContext<AuditLogContextType | undefined>(undefined)

/** Map server audit rows to the client AuditLog shape the UI renders. */
function mapServerRows(rows: unknown): AuditLog[] {
  if (!Array.isArray(rows)) return []
  const sev = (result: unknown): AuditLog['severity'] => {
    if (result === 'failure') return 'error'
    if (result === 'denied') return 'warning'
    return 'info'
  }
  const detailsText = (d: unknown): string => {
    if (typeof d === 'string') return d
    if (d && typeof d === 'object') {
      const o = d as Record<string, unknown>
      if (typeof o.message === 'string') return o.message
      try { return JSON.stringify(d) } catch { return '' }
    }
    return ''
  }
  return rows.map((r: any, i: number) => ({
    id: String(r?.id ?? `srv-${i}`),
    timestamp: String(r?.timestamp ?? new Date().toISOString()),
    userId: String(r?.userId ?? ''),
    userName: String(r?.user?.name ?? r?.userName ?? 'System'),
    userRole: String(r?.user?.role ?? r?.userRole ?? ''),
    action: String(r?.action ?? ''),
    module: String(r?.resource ?? r?.module ?? ''),
    entityType: String(r?.resource ?? r?.entityType ?? ''),
    entityId: String(r?.resourceId ?? r?.entityId ?? ''),
    details: detailsText(r?.details),
    ipAddress: r?.ipAddress ? String(r.ipAddress) : undefined,
    severity: (['info', 'warning', 'error', 'critical'] as const).includes(r?.severity)
      ? r.severity
      : sev(r?.result),
  }))
}

export function AuditLogProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const res = await fetch('/api/audit-logs?limit=500')
        const data = await res.json()
        if (data.success && data.data) {
          const rows = data.data.data || data.data
          setLogs(mapServerRows(rows))
        }
      } catch {
        setLogs([])
      }
    }
    loadLogs()
  }, [])

  const logAction = async (
    action: string,
    module: string,
    entityType: string,
    entityId: string,
    details: string,
    severity: AuditLog['severity'] = 'info'
  ) => {
    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: user?.id || 'unknown',
      userName: user?.name || 'Unknown User',
      userRole: user?.role || 'unknown',
      action,
      module,
      entityType,
      entityId,
      details,
      severity,
    }

    setLogs(prev => [newLog, ...prev])

    try {
      await fetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          resource: module,
          resourceType: entityType,
          resourceId: entityId,
          details: { message: details, severity },
          result: 'success',
        }),
      })
    } catch {
      // Log locally even if API fails
    }
  }

  const getLogsByUser = (userId: string): AuditLog[] => {
    return logs.filter(log => log.userId === userId)
  }

  const getLogsByModule = (module: string): AuditLog[] => {
    return logs.filter(log => log.module === module)
  }

  const getLogsByDateRange = (startDate: string, endDate: string): AuditLog[] => {
    const start = new Date(startDate).getTime()
    const end = new Date(endDate).getTime()
    return logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime()
      return logTime >= start && logTime <= end
    })
  }

  const value: AuditLogContextType = {
    logs,
    logAction,
    getLogsByUser,
    getLogsByModule,
    getLogsByDateRange,
  }

  return (
    <AuditLogContext.Provider value={value}>
      {children}
    </AuditLogContext.Provider>
  )
}

export function useAuditLog() {
  const context = useContext(AuditLogContext)
  if (context === undefined) {
    throw new Error('useAuditLog must be used within an AuditLogProvider')
  }
  return context
}
