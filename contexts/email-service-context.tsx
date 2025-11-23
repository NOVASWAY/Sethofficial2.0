'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { useToast } from '@/hooks/use-toast'

export type EmailProvider = 'sendgrid' | 'mailgun' | 'smtp' | 'mock'

export interface EmailConfig {
  provider: EmailProvider
  apiKey?: string
  domain?: string
  fromEmail: string
  fromName: string
  enabled: boolean
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  htmlContent: string
  textContent: string
  variables: string[]
}

export interface EmailNotification {
  id: string
  type: 'appointment_reminder' | 'prescription_ready' | 'bill_overdue' | 'backup_complete' | 'low_stock' | 'expiry_alert' | 'custom'
  recipient: string
  subject: string
  content: string
  sentAt?: string
  status: 'pending' | 'sent' | 'failed'
  error?: string
  templateId?: string
  variables?: Record<string, string>
}

interface EmailServiceContextType {
  config: EmailConfig
  templates: EmailTemplate[]
  notifications: EmailNotification[]
  updateConfig: (updates: Partial<EmailConfig>) => void
  sendEmail: (to: string, subject: string, content: string, templateId?: string, variables?: Record<string, string>) => Promise<boolean>
  sendTemplateEmail: (to: string, templateId: string, variables?: Record<string, string>) => Promise<boolean>
  addTemplate: (template: Omit<EmailTemplate, 'id'>) => EmailTemplate
  updateTemplate: (id: string, updates: Partial<EmailTemplate>) => void
  deleteTemplate: (id: string) => void
  getNotificationHistory: () => EmailNotification[]
  testEmailConnection: () => Promise<boolean>
}

const EmailServiceContext = createContext<EmailServiceContextType | undefined>(undefined)

const EMAIL_CONFIG_STORAGE_KEY = 'clinic_email_config'
const EMAIL_TEMPLATES_STORAGE_KEY = 'clinic_email_templates'
const EMAIL_NOTIFICATIONS_STORAGE_KEY = 'clinic_email_notifications'

// Default email configuration
const defaultConfig: EmailConfig = {
  provider: 'mock',
  fromEmail: 'noreply@clinic.com',
  fromName: 'Seth Medical Clinic',
  enabled: false,
}

// Default email templates
const defaultTemplates: EmailTemplate[] = [
  {
    id: 'appointment_reminder',
    name: 'Appointment Reminder',
    subject: 'Appointment Reminder - {{clinicName}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Reminder</h2>
        <p>Dear {{patientName}},</p>
        <p>This is a reminder that you have an appointment scheduled:</p>
        <ul>
          <li><strong>Date:</strong> {{appointmentDate}}</li>
          <li><strong>Time:</strong> {{appointmentTime}}</li>
          <li><strong>Doctor:</strong> {{doctorName}}</li>
          <li><strong>Type:</strong> {{appointmentType}}</li>
        </ul>
        <p>Please arrive 15 minutes early for your appointment.</p>
        <p>If you need to reschedule, please contact us at {{clinicPhone}}.</p>
        <p>Best regards,<br>{{clinicName}}</p>
      </div>
    `,
    textContent: `
      Appointment Reminder
      
      Dear {{patientName}},
      
      This is a reminder that you have an appointment scheduled:
      - Date: {{appointmentDate}}
      - Time: {{appointmentTime}}
      - Doctor: {{doctorName}}
      - Type: {{appointmentType}}
      
      Please arrive 15 minutes early for your appointment.
      If you need to reschedule, please contact us at {{clinicPhone}}.
      
      Best regards,
      {{clinicName}}
    `,
    variables: ['patientName', 'appointmentDate', 'appointmentTime', 'doctorName', 'appointmentType', 'clinicName', 'clinicPhone'],
  },
  {
    id: 'prescription_ready',
    name: 'Prescription Ready',
    subject: 'Your Prescription is Ready - {{clinicName}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Prescription Ready</h2>
        <p>Dear {{patientName}},</p>
        <p>Your prescription is ready for pickup at our pharmacy:</p>
        <ul>
          <li><strong>Prescription ID:</strong> {{prescriptionId}}</li>
          <li><strong>Medications:</strong> {{medications}}</li>
          <li><strong>Instructions:</strong> {{instructions}}</li>
        </ul>
        <p>Please bring a valid ID when picking up your prescription.</p>
        <p>Pharmacy Hours: {{pharmacyHours}}</p>
        <p>Best regards,<br>{{clinicName}}</p>
      </div>
    `,
    textContent: `
      Prescription Ready
      
      Dear {{patientName}},
      
      Your prescription is ready for pickup at our pharmacy:
      - Prescription ID: {{prescriptionId}}
      - Medications: {{medications}}
      - Instructions: {{instructions}}
      
      Please bring a valid ID when picking up your prescription.
      Pharmacy Hours: {{pharmacyHours}}
      
      Best regards,
      {{clinicName}}
    `,
    variables: ['patientName', 'prescriptionId', 'medications', 'instructions', 'pharmacyHours', 'clinicName'],
  },
  {
    id: 'bill_overdue',
    name: 'Bill Overdue',
    subject: 'Payment Reminder - {{clinicName}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Payment Reminder</h2>
        <p>Dear {{patientName}},</p>
        <p>This is a reminder that you have an outstanding balance:</p>
        <ul>
          <li><strong>Invoice Number:</strong> {{invoiceNumber}}</li>
          <li><strong>Amount Due:</strong> {{amountDue}}</li>
          <li><strong>Due Date:</strong> {{dueDate}}</li>
          <li><strong>Days Overdue:</strong> {{daysOverdue}}</li>
        </ul>
        <p>Please make payment as soon as possible to avoid any service interruptions.</p>
        <p>Payment Methods: {{paymentMethods}}</p>
        <p>Contact us at {{clinicPhone}} if you have any questions.</p>
        <p>Best regards,<br>{{clinicName}}</p>
      </div>
    `,
    textContent: `
      Payment Reminder
      
      Dear {{patientName}},
      
      This is a reminder that you have an outstanding balance:
      - Invoice Number: {{invoiceNumber}}
      - Amount Due: {{amountDue}}
      - Due Date: {{dueDate}}
      - Days Overdue: {{daysOverdue}}
      
      Please make payment as soon as possible to avoid any service interruptions.
      Payment Methods: {{paymentMethods}}
      Contact us at {{clinicPhone}} if you have any questions.
      
      Best regards,
      {{clinicName}}
    `,
    variables: ['patientName', 'invoiceNumber', 'amountDue', 'dueDate', 'daysOverdue', 'paymentMethods', 'clinicPhone', 'clinicName'],
  },
  {
    id: 'low_stock_alert',
    name: 'Low Stock Alert',
    subject: 'Low Stock Alert - {{itemName}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Low Stock Alert</h2>
        <p>Dear {{recipientName}},</p>
        <p>This is an alert that the following item is running low on stock:</p>
        <ul>
          <li><strong>Item:</strong> {{itemName}}</li>
          <li><strong>Current Stock:</strong> {{currentStock}}</li>
          <li><strong>Minimum Stock:</strong> {{minStock}}</li>
          <li><strong>Category:</strong> {{category}}</li>
        </ul>
        <p>Please consider reordering this item to avoid stockouts.</p>
        <p>Best regards,<br>Inventory Management System</p>
      </div>
    `,
    textContent: `
      Low Stock Alert
      
      Dear {{recipientName}},
      
      This is an alert that the following item is running low on stock:
      - Item: {{itemName}}
      - Current Stock: {{currentStock}}
      - Minimum Stock: {{minStock}}
      - Category: {{category}}
      
      Please consider reordering this item to avoid stockouts.
      
      Best regards,
      Inventory Management System
    `,
    variables: ['recipientName', 'itemName', 'currentStock', 'minStock', 'category'],
  },
]

export function EmailServiceProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<EmailConfig>(defaultConfig)
  const [templates, setTemplates] = useState<EmailTemplate[]>(defaultTemplates)
  const [notifications, setNotifications] = useState<EmailNotification[]>([])
  const { toast } = useToast()

  // Load configuration from localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      const savedConfig = localStorage.getItem(EMAIL_CONFIG_STORAGE_KEY)
      const savedTemplates = localStorage.getItem(EMAIL_TEMPLATES_STORAGE_KEY)
      const savedNotifications = localStorage.getItem(EMAIL_NOTIFICATIONS_STORAGE_KEY)
      
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
      console.error('Error loading email configuration:', error)
    }
  }, [])

  // Save configuration to localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(EMAIL_CONFIG_STORAGE_KEY, JSON.stringify(config))
    } catch (error) {
      console.error('Error saving email configuration:', error)
    }
  }, [config])

  // Save templates to localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(EMAIL_TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
    } catch (error) {
      console.error('Error saving email templates:', error)
    }
  }, [templates])

  // Save notifications to localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(EMAIL_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications))
    } catch (error) {
      console.error('Error saving email notifications:', error)
    }
  }, [notifications])

  // Update configuration
  const updateConfig = (updates: Partial<EmailConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  // Send email (mock implementation)
  const sendEmail = async (
    to: string, 
    subject: string, 
    content: string, 
    templateId?: string, 
    variables?: Record<string, string>
  ): Promise<boolean> => {
    if (!config.enabled) {
      toast({
        title: "Email Service Disabled",
        description: "Email service is currently disabled. Please enable it in settings.",
        variant: "error",
      })
      return false
    }

    const notificationId = `email_${Date.now()}`
    const notification: EmailNotification = {
      id: notificationId,
      type: 'custom',
      recipient: to,
      subject,
      content,
      status: 'pending',
      templateId,
      variables,
    }

    // Add to notifications
    setNotifications(prev => [notification, ...prev])

    try {
      // Simulate email sending based on provider
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Mock success/failure based on provider
      const success = config.provider === 'mock' || Math.random() > 0.1

      if (success) {
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, status: 'sent', sentAt: new Date().toISOString() } : n)
        )
        
        toast({
          title: "Email Sent",
          description: `Email sent successfully to ${to}`,
        })
        return true
      } else {
        throw new Error('Email service temporarily unavailable')
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
        title: "Email Failed",
        description: `Failed to send email to ${to}`,
        variant: "error",
      })
      return false
    }
  }

  // Send template email
  const sendTemplateEmail = async (
    to: string, 
    templateId: string, 
    variables?: Record<string, string>
  ): Promise<boolean> => {
    const template = templates.find(t => t.id === templateId)
    if (!template) {
      toast({
        title: "Template Not Found",
        description: `Email template '${templateId}' not found`,
        variant: "error",
      })
      return false
    }

    // Replace variables in subject and content
    let subject = template.subject
    let content = template.htmlContent

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g')
        subject = subject.replace(regex, value)
        content = content.replace(regex, value)
      })
    }

    return sendEmail(to, subject, content, templateId, variables)
  }

  // Template management
  const addTemplate = (templateData: Omit<EmailTemplate, 'id'>): EmailTemplate => {
    const template: EmailTemplate = {
      ...templateData,
      id: `template_${Date.now()}`,
    }
    setTemplates(prev => [...prev, template])
    return template
  }

  const updateTemplate = (id: string, updates: Partial<EmailTemplate>) => {
    setTemplates(prev => 
      prev.map(template => template.id === id ? { ...template, ...updates } : template)
    )
  }

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(template => template.id !== id))
  }

  // Get notification history
  const getNotificationHistory = (): EmailNotification[] => {
    return notifications
  }

  // Test email connection
  const testEmailConnection = async (): Promise<boolean> => {
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
          description: "Email service connection is working properly",
        })
      } else {
        toast({
          title: "Connection Test Failed",
          description: "Unable to connect to email service. Please check your configuration.",
          variant: "error",
        })
      }
      
      return success
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: "Error testing email connection",
        variant: "error",
      })
      return false
    }
  }

  const value: EmailServiceContextType = {
    config,
    templates,
    notifications,
    updateConfig,
    sendEmail,
    sendTemplateEmail,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    getNotificationHistory,
    testEmailConnection,
  }

  return (
    <EmailServiceContext.Provider value={value}>
      {children}
    </EmailServiceContext.Provider>
  )
}

export function useEmailService() {
  const context = useContext(EmailServiceContext)
  if (context === undefined) {
    throw new Error('useEmailService must be used within an EmailServiceProvider')
  }
  return context
}
