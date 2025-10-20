'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

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

const AUDIT_LOGS_STORAGE_KEY = 'clinic_audit_logs_data'
const MAX_LOGS = 1000 // Keep only last 1000 logs to prevent storage overflow

// Default mock logs for first-time users
const defaultLogs: AuditLog[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    userId: 'user-001',
    userName: 'Admin User',
    userRole: 'admin',
    action: 'CREATE_PATIENT',
    module: 'registration',
    entityType: 'patient',
    entityId: 'PAT-2025-0001',
    details: 'Registered new patient: John Doe',
    severity: 'info',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    userId: 'user-002',
    userName: 'Dr. Sarah Johnson',
    userRole: 'clinician',
    action: 'CREATE_CONSULTATION',
    module: 'consultation',
    entityType: 'consultation',
    entityId: 'CON-202510-001',
    details: 'Completed consultation for patient PAT-2025-0001',
    severity: 'info',
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    userId: 'user-003',
    userName: 'Pharmacist Jane',
    userRole: 'pharmacist',
    action: 'DISPENSE_MEDICATION',
    module: 'pharmacy',
    entityType: 'prescription',
    entityId: 'RX-202510-001',
    details: 'Dispensed Amoxicillin 500mg x 21',
    severity: 'info',
  },
]

export function AuditLogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedLogs = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY)
      if (savedLogs) {
        setLogs(JSON.parse(savedLogs))
      } else {
        setLogs(defaultLogs)
      }
    } catch (error) {
      console.error('Error loading audit logs from localStorage:', error)
      setLogs(defaultLogs)
    } finally {
      setIsInitialized(true)
    }
  }, [])

  // Save logs to localStorage whenever they change (with size limit)
  useEffect(() => {
    if (isInitialized) {
      try {
        // Keep only the most recent MAX_LOGS entries
        const logsToSave = logs.slice(0, MAX_LOGS)
        localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logsToSave))
      } catch (error) {
        console.error('Error saving audit logs to localStorage:', error)
      }
    }
  }, [logs, isInitialized])

  const logAction = (
    action: string,
    module: string,
    entityType: string,
    entityId: string,
    details: string,
    severity: AuditLog['severity'] = 'info'
  ) => {
    // Get current user from auth context (mock for now)
    const currentUser = {
      id: 'current-user',
      name: 'Current User',
      role: 'admin',
    }

    const newLog: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      module,
      entityType,
      entityId,
      details,
      severity,
    }

    setLogs(prev => [newLog, ...prev])
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

