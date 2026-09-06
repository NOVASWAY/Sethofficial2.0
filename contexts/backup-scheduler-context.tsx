'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'

export type BackupInterval = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'disabled'

export interface BackupSchedule {
  enabled: boolean
  interval: BackupInterval
  time?: string // For daily/weekly/monthly backups (HH:MM format)
  dayOfWeek?: number // 0-6 for weekly backups (0 = Sunday)
  dayOfMonth?: number // 1-31 for monthly backups
  maxBackups: number // Maximum number of backups to keep
  lastBackup?: string | null
  nextBackup?: string | null
}

interface BackupSchedulerContextType {
  schedule: BackupSchedule
  updateSchedule: (updates: Partial<BackupSchedule>) => void
  isBackupRunning: boolean
  triggerBackup: () => Promise<void>
  getBackupStatus: () => {
    isEnabled: boolean
    nextBackup: string | null
    lastBackup: string | null
    status: 'idle' | 'running' | 'scheduled' | 'disabled'
  }
}

const BackupSchedulerContext = createContext<BackupSchedulerContextType | undefined>(undefined)

const BACKUP_SCHEDULE_STORAGE_KEY = 'clinic_backup_schedule'
const BACKUP_HISTORY_STORAGE_KEY = 'clinic_backup_history'

// Default backup schedule
const defaultSchedule: BackupSchedule = {
  enabled: false,
  interval: 'daily',
  time: '02:00',
  maxBackups: 30,
}

export function BackupSchedulerProvider({ children }: { children: ReactNode }) {
  const [schedule, setSchedule] = useState<BackupSchedule>(defaultSchedule)
  const [isBackupRunning, setIsBackupRunning] = useState(false)
  const [backupHistory, setBackupHistory] = useState<Array<{
    id: string
    timestamp: string
    size: number
    status: 'success' | 'failed'
    error?: string
  }>>([])

  const { toast } = useToast()

  const exportBackup = (): string => {
    const data: Record<string, any> = {}
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('clinic_')) {
          data[key] = localStorage.getItem(key)
        }
      }
    } catch (error) {
      console.error('Error exporting backup:', error)
    }
    return JSON.stringify(data, null, 2)
  }

  // Load schedule from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const savedSchedule = localStorage.getItem(BACKUP_SCHEDULE_STORAGE_KEY)
      const savedHistory = localStorage.getItem(BACKUP_HISTORY_STORAGE_KEY)

      if (savedSchedule) {
        setSchedule(JSON.parse(savedSchedule))
      }

      if (savedHistory) {
        setBackupHistory(JSON.parse(savedHistory))
      }
    } catch (error) {
      console.error('Error loading backup schedule from localStorage:', error)
    }
  }, [])

  // Save schedule to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(BACKUP_SCHEDULE_STORAGE_KEY, JSON.stringify(schedule))
    } catch (error) {
      console.error('Error saving backup schedule to localStorage:', error)
    }
  }, [schedule])

  // Save backup history to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(BACKUP_HISTORY_STORAGE_KEY, JSON.stringify(backupHistory))
    } catch (error) {
      console.error('Error saving backup history to localStorage:', error)
    }
  }, [backupHistory])

  // Calculate next backup time
  const calculateNextBackup = (schedule: BackupSchedule): string | null => {
    if (!schedule.enabled || schedule.interval === 'disabled') {
      return null
    }

    const now = new Date()
    const nextBackup = new Date()

    switch (schedule.interval) {
      case 'hourly':
        nextBackup.setHours(now.getHours() + 1, 0, 0, 0)
        break
      case 'daily':
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number)
          nextBackup.setHours(hours, minutes, 0, 0)
          if (nextBackup <= now) {
            nextBackup.setDate(nextBackup.getDate() + 1)
          }
        } else {
          nextBackup.setDate(now.getDate() + 1)
        }
        break
      case 'weekly':
        if (schedule.dayOfWeek !== undefined && schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number)
          const daysUntilTarget = (schedule.dayOfWeek - now.getDay() + 7) % 7
          nextBackup.setDate(now.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget))
          nextBackup.setHours(hours, minutes, 0, 0)
        } else {
          nextBackup.setDate(now.getDate() + 7)
        }
        break
      case 'monthly':
        if (schedule.dayOfMonth && schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number)
          nextBackup.setDate(schedule.dayOfMonth)
          nextBackup.setHours(hours, minutes, 0, 0)
          if (nextBackup <= now) {
            nextBackup.setMonth(nextBackup.getMonth() + 1)
          }
        } else {
          nextBackup.setMonth(now.getMonth() + 1)
        }
        break
    }

    return nextBackup.toISOString()
  }

  // Update schedule
  const updateSchedule = (updates: Partial<BackupSchedule>) => {
    const newSchedule = { ...schedule, ...updates }
    const nextBackup = calculateNextBackup(newSchedule)
    setSchedule({ ...newSchedule, nextBackup })
  }

  // Trigger backup manually
  const triggerBackup = async (): Promise<void> => {
    if (isBackupRunning) return

    setIsBackupRunning(true)
    const backupId = `backup_${Date.now()}`
    const startTime = new Date()

    try {
      // Generate backup data
      const backupData = exportBackup()
      const backupSize = new Blob([backupData]).size

      // Simulate backup process (in real app, this would upload to cloud storage)
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Record successful backup
      const backupRecord = {
        id: backupId,
        timestamp: startTime.toISOString(),
        size: backupSize,
        status: 'success' as const,
      }

      setBackupHistory(prev => {
        const newHistory = [backupRecord, ...prev].slice(0, schedule.maxBackups)
        return newHistory
      })

      // Update last backup time
      setSchedule(prev => ({
        ...prev,
        lastBackup: startTime.toISOString(),
        nextBackup: calculateNextBackup(prev),
      }))

      toast({
        title: "Backup Completed",
        description: `Backup created successfully (${(backupSize / 1024).toFixed(1)} KB)`,
      })

    } catch (error) {
      // Record failed backup
      const backupRecord = {
        id: backupId,
        timestamp: startTime.toISOString(),
        size: 0,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Unknown error',
      }

      setBackupHistory(prev => [backupRecord, ...prev])

      toast({
        title: "Backup Failed",
        description: "Failed to create backup. Please try again.",
        variant: "error",
      })
    } finally {
      setIsBackupRunning(false)
    }
  }

  // Get backup status
  const getBackupStatus = () => {
    const now = new Date()
    const nextBackup = schedule.nextBackup ? new Date(schedule.nextBackup) : null
    const lastBackup = schedule.lastBackup ? new Date(schedule.lastBackup) : null

    let status: 'idle' | 'running' | 'scheduled' | 'disabled' = 'disabled'

    if (isBackupRunning) {
      status = 'running'
    } else if (schedule.enabled && nextBackup) {
      status = 'scheduled'
    } else if (schedule.enabled) {
      status = 'idle'
    }

    return {
      isEnabled: schedule.enabled,
      nextBackup: nextBackup?.toLocaleString() || null,
      lastBackup: lastBackup?.toLocaleString() || null,
      status,
    }
  }

  // Auto-backup scheduler
  useEffect(() => {
    if (!schedule.enabled || schedule.interval === 'disabled') {
      return
    }

    const checkBackupTime = () => {
      const now = new Date()
      const nextBackup = schedule.nextBackup ? new Date(schedule.nextBackup) : null

      if (nextBackup && now >= nextBackup) {
        triggerBackup()
      }
    }

    // Check every minute
    const interval = setInterval(checkBackupTime, 60000)

    return () => clearInterval(interval)
  }, [schedule.enabled, schedule.nextBackup, schedule.interval])

  const value: BackupSchedulerContextType = {
    schedule,
    updateSchedule,
    isBackupRunning,
    triggerBackup,
    getBackupStatus,
  }

  return (
    <BackupSchedulerContext.Provider value={value}>
      {children}
    </BackupSchedulerContext.Provider>
  )
}

export function useBackupScheduler() {
  const context = useContext(BackupSchedulerContext)
  if (context === undefined) {
    throw new Error('useBackupScheduler must be used within a BackupSchedulerProvider')
  }
  return context
}
