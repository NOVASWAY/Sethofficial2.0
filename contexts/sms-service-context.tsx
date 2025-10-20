'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'

export type SMSProvider = 'africas_talking' | 'twilio' | 'mock'

export interface SMSConfig {
  provider: SMSProvider
  apiKey?: string
  username?: string // For Africa's Talking
  accountSid?: string // For Twilio
  authToken?: string // For Twilio
  fromNumber: string
  enabled: boolean
}

export interface SMSTemplate {
  id: string
  name: string
  content: string
  variables: string[]
  type: 'appointment_reminder' | 'prescription_ready' | 'bill_overdue' | 'low_stock' | 'expiry_alert' | 'custom'
}

export interface SMSNotification {
  id: string
  type: 'appointment_reminder' | 'prescription_ready' | 'bill_overdue' | 'low_stock' | 'expiry_alert' | 'custom'
  recipient: string
  content: string
  sentAt?: string
  status: 'pending' | 'sent' | 'failed' | 'delivered'
  error?: string
  templateId?: string
  variables?: Record<string, string>
  cost?: number
}

interface SMSServiceContextType {
  config: SMSConfig
  templates: SMSTemplate[]
  notifications: SMSNotification[]
  updateConfig: (updates: Partial<SMSConfig>) => void
  sendSMS: (to: string, content: string, templateId?: string, variables?: Record<string, string>) => Promise<boolean>
  sendTemplateSMS: (to: string, templateId: string, variables?: Record<string, string>) => Promise<boolean>
  addTemplate: (template: Omit<SMSTemplate, 'id'>) => SMSTemplate
  updateTemplate: (id: string, updates: Partial<SMSTemplate>) => void
  deleteTemplate: (id: string) => void
  getNotificationHistory: () => SMSNotification[]
  testSMSConnection: () => Promise<boolean>
  getSMSBalance: () => Promise<number>
}

const SMSServiceContext = createContext<SMSServiceContextType | undefined>(undefined)

const SMS_CONFIG_STORAGE_KEY = 'clinic_sms_config'
const SMS_TEMPLATES_STORAGE_KEY = 'clinic_sms_templates'
const SMS_NOTIFICATIONS_STORAGE_KEY = 'clinic_sms_notifications'

// Default SMS configuration
const defaultConfig: SMSConfig = {
  provider: 'mock',
  fromNumber: '+254700000000',
  enabled: false,
}

// Default SMS templates
const defaultTemplates: SMSTemplate[] = [
  {
    id: 'appointment_reminder',
    name: 'Appointment Reminder',
    content: 'Hi {{patientName}}, you have an appointment on {{appointmentDate}} at {{appointmentTime}} with Dr. {{doctorName}}. Please arrive 15 mins early. Call {{clinicPhone}} to reschedule. - {{clinicName}}',
    variables: ['patientName', 'appointmentDate', 'appointmentTime', 'doctorName', 'clinicPhone', 'clinicName'],
    type: 'appointment_reminder',
  },
  {
    id: 'prescription_ready',
    name: 'Prescription Ready',
    content: 'Hi {{patientName}}, your prescription #{{prescriptionId}} is ready for pickup. Medications: {{medications}}. Bring valid ID. - {{clinicName}}',
    variables: ['patientName', 'prescriptionId', 'medications', 'clinicName'],
    type: 'prescription_ready',
  },
  {
    id: 'bill_overdue',
    name: 'Bill Overdue',
    content: 'Hi {{patientName}}, you have an outstanding balance of {{amountDue}} for invoice #{{invoiceNumber}}. Due: {{dueDate}}. Please pay to avoid service interruption. - {{clinicName}}',
    variables: ['patientName', 'amountDue', 'invoiceNumber', 'dueDate', 'clinicName'],
    type: 'bill_overdue',
  },
  {
    id: 'low_stock_alert',
    name: 'Low Stock Alert',
    content: 'ALERT: {{itemName}} is running low ({{currentStock}} remaining, min: {{minStock}}). Please reorder soon. - Inventory System',
    variables: ['itemName', 'currentStock', 'minStock'],
    type: 'low_stock',
  },
  {
    id: 'expiry_alert',
    name: 'Expiry Alert',
    content: 'ALERT: {{itemName}} expires on {{expiryDate}} ({{daysLeft}} days left). Please use or dispose soon. - Inventory System',
    variables: ['itemName', 'expiryDate', 'daysLeft'],
    type: 'expiry_alert',
  },
]

export function SMSServiceProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<SMSConfig>(defaultConfig)
  const [templates, setTemplates] = useState<SMSTemplate[]>(defaultTemplates)
  const [notifications, setNotifications] = useState<SMSNotification[]>([])
  const { toast } = useToast()

  // Load configuration from localStorage
  React.useEffect(() => {
    try {
      const savedConfig = localStorage.getItem(SMS_CONFIG_STORAGE_KEY)
      const savedTemplates = localStorage.getItem(SMS_TEMPLATES_STORAGE_KEY)
      const savedNotifications = localStorage.getItem(SMS_NOTIFICATIONS_STORAGE_KEY)
      
      if (savedConfig) {
        setConfig(JSON.parse(savedConfig))
      }
      
      if (savedTemplates) {
        setTemplates(JSON.parse(savedTemplates))
      }
      
      if (savedNotifications) {
        setNotifications(JSON.parse(savedNotifications))
      }
    } catch (error) {
      console.error('Error loading SMS configuration:', error)
    }
  }, [])

  // Save configuration to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(SMS_CONFIG_STORAGE_KEY, JSON.stringify(config))
    } catch (error) {
      console.error('Error saving SMS configuration:', error)
    }
  }, [config])

  // Save templates to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(SMS_TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
    } catch (error) {
      console.error('Error saving SMS templates:', error)
    }
  }, [templates])

  // Save notifications to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem(SMS_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications))
    } catch (error) {
      console.error('Error saving SMS notifications:', error)
    }
  }, [notifications])

  // Update configuration
  const updateConfig = (updates: Partial<SMSConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  // Send SMS (mock implementation)
  const sendSMS = async (
    to: string, 
    content: string, 
    templateId?: string, 
    variables?: Record<string, string>
  ): Promise<boolean> => {
    if (!config.enabled) {
      toast({
        title: "SMS Service Disabled",
        description: "SMS service is currently disabled. Please enable it in settings.",
        variant: "error",
      })
      return false
    }

    // Validate phone number (basic Kenyan format)
    const phoneRegex = /^(\+254|0)[17]\d{8}$/
    if (!phoneRegex.test(to)) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Kenyan phone number (e.g., +254700000000 or 0700000000)",
        variant: "error",
      })
      return false
    }

    const notificationId = `sms_${Date.now()}`
    const notification: SMSNotification = {
      id: notificationId,
      type: 'custom',
      recipient: to,
      content,
      status: 'pending',
      templateId,
      variables,
      cost: content.length > 160 ? Math.ceil(content.length / 160) * 2 : 2, // Mock cost calculation
    }

    // Add to notifications
    setNotifications(prev => [notification, ...prev])

    try {
      // Simulate SMS sending based on provider
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Mock success/failure based on provider
      const success = config.provider === 'mock' || Math.random() > 0.15

      if (success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { 
            ...n, 
            status: 'sent', 
            sentAt: new Date().toISOString() 
          } : n)
        )
        
        toast({
          title: "SMS Sent",
          description: `SMS sent successfully to ${to}`,
        })
        return true
      } else {
        throw new Error('SMS service temporarily unavailable')
      }
    } catch (error) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { 
          ...n, 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } : n)
      )
      
      toast({
        title: "SMS Failed",
        description: `Failed to send SMS to ${to}`,
        variant: "error",
      })
      return false
    }
  }

  // Send template SMS
  const sendTemplateSMS = async (
    to: string, 
    templateId: string, 
    variables?: Record<string, string>
  ): Promise<boolean> => {
    const template = templates.find(t => t.id === templateId)
    if (!template) {
      toast({
        title: "Template Not Found",
        description: `SMS template '${templateId}' not found`,
        variant: "error",
      })
      return false
    }

    // Replace variables in content
    let content = template.content

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g')
        content = content.replace(regex, value)
      })
    }

    return sendSMS(to, content, templateId, variables)
  }

  // Template management
  const addTemplate = (templateData: Omit<SMSTemplate, 'id'>): SMSTemplate => {
    const template: SMSTemplate = {
      ...templateData,
      id: `template_${Date.now()}`,
    }
    setTemplates(prev => [...prev, template])
    return template
  }

  const updateTemplate = (id: string, updates: Partial<SMSTemplate>) => {
    setTemplates(prev => 
      prev.map(template => template.id === id ? { ...template, ...updates } : template)
    )
  }

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(template => template.id !== id))
  }

  // Get notification history
  const getNotificationHistory = (): SMSNotification[] => {
    return notifications
  }

  // Test SMS connection
  const testSMSConnection = async (): Promise<boolean> => {
    if (!config.enabled) {
      return false
    }

    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Mock success based on provider
      const success = config.provider === 'mock' || Math.random() > 0.2
      
      if (success) {
        toast({
          title: "Connection Test Successful",
          description: "SMS service connection is working properly",
        })
      } else {
        toast({
          title: "Connection Test Failed",
          description: "Unable to connect to SMS service. Please check your configuration.",
          variant: "error",
        })
      }
      
      return success
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: "Error testing SMS connection",
        variant: "error",
      })
      return false
    }
  }

  // Get SMS balance (mock implementation)
  const getSMSBalance = async (): Promise<number> => {
    if (!config.enabled) {
      return 0
    }

    try {
      // Simulate balance check
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock balance based on provider
      const balance = config.provider === 'mock' ? 1000 : Math.floor(Math.random() * 500) + 50
      return balance
    } catch (error) {
      console.error('Error getting SMS balance:', error)
      return 0
    }
  }

  const value: SMSServiceContextType = {
    config,
    templates,
    notifications,
    updateConfig,
    sendSMS,
    sendTemplateSMS,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getNotificationHistory,
    testSMSConnection,
    getSMSBalance,
  }

  return (
    <SMSServiceContext.Provider value={value}>
      {children}
    </SMSServiceContext.Provider>
  )
}

export function useSMSService() {
  const context = useContext(SMSServiceContext)
  if (context === undefined) {
    throw new Error('useSMSService must be used within an SMSServiceProvider')
  }
  return context
}
