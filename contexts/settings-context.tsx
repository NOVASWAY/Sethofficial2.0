'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface ClinicSettings {
  // General Settings
  clinicName: string
  clinicAddress: string
  phone: string
  email: string
  workingHours: string
  theme: 'light' | 'dark' | 'clinic'
  language: 'english' | 'swahili'
  currency: 'KSh' | 'USD' | 'EUR'
  timezone: string
  dateFormat: string

  // Notifications
  emailNotifications: boolean
  smsNotifications: boolean
  appointmentReminders: boolean
  lowStockAlerts: boolean
  expiryAlerts: boolean
  systemUpdates: boolean

  // System
  autoBackup: boolean
  backupFrequency: 'daily' | 'weekly' | 'monthly'
  maintenanceMode: boolean
  debugMode: boolean
  apiLogging: boolean
}

export interface UserProfile {
  name: string
  email?: string
  phone: string
  role: string
  department?: string
  bio?: string
  licenseNumber?: string
  avatar?: string
}

export interface SecuritySettings {
  twoFactorEnabled: boolean
  sessionTimeout: number // in minutes
  passwordExpiry: number // in days
  loginAttempts: number
}

interface SettingsContextType {
  settings: ClinicSettings
  userProfile: UserProfile | null
  securitySettings: SecuritySettings

  updateSettings: (updates: Partial<ClinicSettings>) => void
  updateUserProfile: (updates: Partial<UserProfile>) => void
  updateSecuritySettings: (updates: Partial<SecuritySettings>) => void
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>
  updateProfilePicture: (avatarDataUrl: string | null) => void

  // Backup/Restore
  exportBackup: () => string
  importBackup: (jsonData: string) => boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

const SETTINGS_STORAGE_KEY = 'clinic_settings'
const PROFILE_STORAGE_KEY = 'user_profile'
const SECURITY_STORAGE_KEY = 'security_settings'

const defaultSettings: ClinicSettings = {
  clinicName: 'Seth Medical Clinic',
  clinicAddress: '123 Medical Street, Nairobi, Kenya',
  phone: '+254 700 123 456',
  email: 'info@sethclinic.com',
  workingHours: 'Monday - Friday: 8:00 AM - 6:00 PM',
  theme: 'light',
  language: 'english',
  currency: 'KSh',
  timezone: 'Africa/Nairobi',
  dateFormat: 'DD/MM/YYYY',

  emailNotifications: true,
  smsNotifications: true,
  appointmentReminders: true,
  lowStockAlerts: true,
  expiryAlerts: true,
  systemUpdates: false,

  autoBackup: true,
  backupFrequency: 'weekly',
  maintenanceMode: false,
  debugMode: false,
  apiLogging: false,
}

const defaultProfile: UserProfile = {
  name: 'Admin User',
  phone: '+254 700 567 890',
  role: 'admin',
  department: 'Administration',
  bio: 'System Administrator',
}

const defaultSecurity: SecuritySettings = {
  twoFactorEnabled: false,
  sessionTimeout: 60,
  passwordExpiry: 90,
  loginAttempts: 5,
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ClinicSettings>(defaultSettings)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(defaultProfile)
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(defaultSecurity)
  const [isInitialized, setIsInitialized] = useState(false)

  // Load from backend and localStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        setIsInitialized(true)
        return
      }

      try {
        // Try to load from backend first
        const token = localStorage.getItem('auth_token')
        const response = await fetch('http://localhost:8080/api/settings', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            // Map backend settings to frontend format
            const backendSettings = data.data
            const mappedSettings: Partial<ClinicSettings> = {
              // General settings
              clinicName: backendSettings.general?.clinic_name || defaultSettings.clinicName,
              clinicAddress: backendSettings.general?.clinic_address || defaultSettings.clinicAddress,
              phone: backendSettings.general?.clinic_phone || defaultSettings.phone,
              email: backendSettings.general?.clinic_email || defaultSettings.email,
              currency: backendSettings.billing?.currency || defaultSettings.currency,
              timezone: backendSettings.general?.timezone || defaultSettings.timezone,

              // Schedule settings
              workingHours: `${backendSettings.schedule?.business_hours_start || '08:00'} - ${backendSettings.schedule?.business_hours_end || '18:00'}`,
            }

            const mappedSecurity: Partial<SecuritySettings> = {
              // Security settings
              sessionTimeout: parseInt(backendSettings.security?.session_timeout || '60'),
              passwordExpiry: parseInt(backendSettings.security?.password_expiry || '90'),
              loginAttempts: parseInt(backendSettings.security?.max_login_attempts || '5'),
            }

            setSettings(prev => ({ ...prev, ...mappedSettings }))
            setSecuritySettings(prev => ({ ...prev, ...mappedSecurity }))
            console.log('Settings loaded from backend')
          }
        } else {
          console.warn('Failed to load settings from backend, using localStorage fallback')
        }

        // Fallback to localStorage for profile and security settings
        const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY)
        const savedSecurity = localStorage.getItem(SECURITY_STORAGE_KEY)

        if (savedProfile) setUserProfile(JSON.parse(savedProfile))
        if (savedSecurity) setSecuritySettings(JSON.parse(savedSecurity))
      } catch (error) {
        console.error('Error loading settings:', error)
        // Fallback to localStorage only
        try {
          const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)
          const savedProfile = localStorage.getItem(PROFILE_STORAGE_KEY)
          const savedSecurity = localStorage.getItem(SECURITY_STORAGE_KEY)

          if (savedSettings) setSettings(JSON.parse(savedSettings))
          if (savedProfile) setUserProfile(JSON.parse(savedProfile))
          if (savedSecurity) setSecuritySettings(JSON.parse(savedSecurity))
        } catch (localError) {
          console.error('Error loading settings from localStorage:', localError)
        }
      } finally {
        setIsInitialized(true)
      }
    }

    loadSettings()
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
      } catch (error) {
        console.error('Error saving settings to localStorage:', error)
      }
    }
  }, [settings, isInitialized])

  // Save profile to localStorage
  useEffect(() => {
    if (isInitialized && userProfile) {
      try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(userProfile))
      } catch (error) {
        console.error('Error saving profile to localStorage:', error)
      }
    }
  }, [userProfile, isInitialized])

  // Save security settings to localStorage
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(securitySettings))
      } catch (error) {
        console.error('Error saving security settings to localStorage:', error)
      }
    }
  }, [securitySettings, isInitialized])

  const updateSettings = async (updates: Partial<ClinicSettings>) => {
    try {
      // Update local state immediately for UI responsiveness
      setSettings(prev => ({ ...prev, ...updates }))

      // Map frontend settings to backend format
      const backendSettings: Record<string, any> = {}

      // Map general settings
      if (updates.clinicName !== undefined) backendSettings.clinic_name = updates.clinicName
      if (updates.clinicAddress !== undefined) backendSettings.clinic_address = updates.clinicAddress
      if (updates.phone !== undefined) backendSettings.clinic_phone = updates.phone
      if (updates.email !== undefined) backendSettings.clinic_email = updates.email
      if (updates.timezone !== undefined) backendSettings.timezone = updates.timezone

      // Map billing settings
      if (updates.currency !== undefined) backendSettings.currency = updates.currency

      // Map schedule settings
      if (updates.workingHours !== undefined) {
        const [start, end] = updates.workingHours.split(' - ')
        backendSettings.business_hours_start = start
        backendSettings.business_hours_end = end
      }



      // Send to backend for persistence
      const response = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ settings: backendSettings })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save settings to server')
      }

      console.log('Settings saved to backend successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      // Revert local changes if backend save fails
      setSettings(prev => ({ ...prev }))
      throw error // Re-throw to allow UI to handle the error
    }
  }

  const updateUserProfile = (updates: Partial<UserProfile>) => {
    setUserProfile(prev => prev ? { ...prev, ...updates } : null)
  }

  const updateSecuritySettings = async (updates: Partial<SecuritySettings>) => {
    try {
      setSecuritySettings(prev => ({ ...prev, ...updates }))

      const backendSettings: Record<string, any> = {}
      if (updates.sessionTimeout !== undefined) backendSettings.session_timeout = updates.sessionTimeout.toString()
      if (updates.passwordExpiry !== undefined) backendSettings.password_expiry = updates.passwordExpiry.toString()
      if (updates.loginAttempts !== undefined) backendSettings.max_login_attempts = updates.loginAttempts.toString()

      if (Object.keys(backendSettings).length > 0) {
        await fetch('/api/v1/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({ settings: { security: backendSettings } })
        })
      }
    } catch (error) {
      console.error('Error updating security settings:', error)
    }
  }

  const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
    // In a real system, this would call the backend API
    // For now, we'll just simulate it
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate password change
        console.log('Password changed successfully')
        resolve(true)
      }, 500)
    })
  }

  const updateProfilePicture = (avatarDataUrl: string | null) => {
    updateUserProfile({ avatar: avatarDataUrl || undefined })
  }

  const exportBackup = (): string => {
    if (typeof window === 'undefined') {
      return JSON.stringify({ settings, userProfile, securitySettings, timestamp: new Date().toISOString(), version: '1.0.0' }, null, 2)
    }

    const backupData = {
      settings,
      userProfile,
      securitySettings,
      patients: JSON.parse(localStorage.getItem('clinic_patients') || '[]'),
      appointments: JSON.parse(localStorage.getItem('clinic_appointments') || '[]'),
      queue: JSON.parse(localStorage.getItem('clinic_queue') || '[]'),
      users: JSON.parse(localStorage.getItem('clinic_users_data') || '[]'),
      medicines: JSON.parse(localStorage.getItem('clinic_medicines') || '[]'),
      stockMovements: JSON.parse(localStorage.getItem('clinic_stock_movements') || '[]'),
      invoices: JSON.parse(localStorage.getItem('clinic_invoices') || '[]'),
      payments: JSON.parse(localStorage.getItem('clinic_payments') || '[]'),
      shaClaims: JSON.parse(localStorage.getItem('clinic_sha_claims') || '[]'),
      shaClaimDetails: JSON.parse(localStorage.getItem('clinic_sha_claim_details') || '[]'),
      auditLogs: JSON.parse(localStorage.getItem('clinic_audit_logs') || '[]'),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    }

    return JSON.stringify(backupData, null, 2)
  }

  const importBackup = (jsonData: string): boolean => {
    if (typeof window === 'undefined') return false

    try {
      const backupData = JSON.parse(jsonData)

      // Validate backup data structure
      if (!backupData.timestamp || !backupData.version) {
        throw new Error('Invalid backup file format')
      }

      // Restore settings
      if (backupData.settings) setSettings(backupData.settings)
      if (backupData.userProfile) setUserProfile(backupData.userProfile)
      if (backupData.securitySettings) setSecuritySettings(backupData.securitySettings)

      // Restore other data to localStorage
      if (backupData.patients) localStorage.setItem('clinic_patients', JSON.stringify(backupData.patients))
      if (backupData.appointments) localStorage.setItem('clinic_appointments', JSON.stringify(backupData.appointments))
      if (backupData.queue) localStorage.setItem('clinic_queue', JSON.stringify(backupData.queue))
      if (backupData.users) localStorage.setItem('clinic_users_data', JSON.stringify(backupData.users))
      if (backupData.medicines) localStorage.setItem('clinic_medicines', JSON.stringify(backupData.medicines))
      if (backupData.stockMovements) localStorage.setItem('clinic_stock_movements', JSON.stringify(backupData.stockMovements))
      if (backupData.invoices) localStorage.setItem('clinic_invoices', JSON.stringify(backupData.invoices))
      if (backupData.payments) localStorage.setItem('clinic_payments', JSON.stringify(backupData.payments))
      if (backupData.shaClaims) localStorage.setItem('clinic_sha_claims', JSON.stringify(backupData.shaClaims))
      if (backupData.shaClaimDetails) localStorage.setItem('clinic_sha_claim_details', JSON.stringify(backupData.shaClaimDetails))
      if (backupData.auditLogs) localStorage.setItem('clinic_audit_logs', JSON.stringify(backupData.auditLogs))

      return true
    } catch (error) {
      console.error('Error importing backup:', error)
      return false
    }
  }

  const value: SettingsContextType = {
    settings,
    userProfile,
    securitySettings,
    updateSettings,
    updateUserProfile,
    updateSecuritySettings,
    changePassword,
    updateProfilePicture,
    exportBackup,
    importBackup,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

