'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Mail, 
  Settings, 
  TestTube, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Eye,
  Edit,
  Trash2,
  Plus
} from 'lucide-react'
import { useTranslation } from '@/contexts/language-context'

interface EmailProviderConfig {
  enabled: boolean
  provider: 'sendgrid' | 'mailgun' | 'smtp' | 'mock'
  apiKey: string
  domain: string
  fromEmail: string
  fromName: string
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  content: string
  variables: string[]
}

interface EmailNotification {
  id: string
  recipient: string
  subject: string
  status: 'sent' | 'failed' | 'pending'
  sentAt?: string
  error?: string
}

export function EmailSettings() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<EmailProviderConfig>({
    enabled: false,
    provider: 'mock',
    apiKey: '',
    domain: '',
    fromEmail: '',
    fromName: 'Seth Medical Clinic',
  })
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [notifications, setNotifications] = useState<EmailNotification[]>([])
  
  const [isTesting, setIsTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [activeTab, setActiveTab] = useState('config')

  const updateConfig = (updates: Partial<EmailProviderConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  const sendEmail = async (to: string, subject: string, body: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      })
      const notification: EmailNotification = {
        id: `email-${Date.now()}`,
        recipient: to,
        subject,
        status: response.ok ? 'sent' : 'failed',
        sentAt: new Date().toISOString(),
      }
      setNotifications(prev => [notification, ...prev])
      return response.ok
    } catch (error) {
      const notification: EmailNotification = {
        id: `email-${Date.now()}`,
        recipient: to,
        subject,
        status: 'failed',
        sentAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }
      setNotifications(prev => [notification, ...prev])
      return false
    }
  }

  const sendTemplateEmail = async (to: string, templateId: string, variables: Record<string, string>): Promise<boolean> => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return false
    let content = template.content
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }
    return sendEmail(to, template.subject, content)
  }

  const addTemplate = (template: Omit<EmailTemplate, 'id'>) => {
    setTemplates(prev => [...prev, { ...template, id: `template-${Date.now()}` }])
  }

  const updateTemplate = (id: string, updates: Partial<EmailTemplate>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const testEmailConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      return response.ok
    } catch (error) {
      return false
    }
  }

  const handleConfigUpdate = (field: keyof typeof config, value: any) => {
    updateConfig({ [field]: value })
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    await testEmailConnection()
    setIsTesting(false)
  }

  const handleSendTestEmail = async () => {
    if (!testEmail) return
    
    const success = await sendEmail(
      testEmail,
      'Test Email from Clinic Management System',
      `
        <h2>Test Email</h2>
        <p>This is a test email from the Clinic Management System.</p>
        <p>If you received this email, the email service is working correctly.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `
    )
    
    if (success) {
      setTestEmail('')
    }
  }

  const getProviderLabel = (provider: EmailProviderConfig['provider']) => {
    switch (provider) {
      case 'sendgrid': return 'SendGrid'
      case 'mailgun': return 'Mailgun'
      case 'smtp': return 'SMTP'
      case 'mock': return 'Mock (Development)'
      default: return provider
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500">Sent</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="h-5 w-5" />
            <span>Email Service Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure email service settings for notifications and alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Configuration Tab */}
            <TabsContent value="config" className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-email">Enable Email Service</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable email notifications and alerts
                  </p>
                </div>
                <Switch
                  id="enable-email"
                  checked={config.enabled}
                  onCheckedChange={(enabled) => handleConfigUpdate('enabled', enabled)}
                />
              </div>

              {/* Email Provider */}
              <div className="space-y-2">
                <Label htmlFor="email-provider">Email Provider</Label>
                <Select
                  value={config.provider}
                  onValueChange={(value) => handleConfigUpdate('provider', value as EmailProviderConfig['provider'])}
                  disabled={!config.enabled}
                >
                  <SelectTrigger id="email-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mock">Mock (Development)</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="mailgun">Mailgun</SelectItem>
                    <SelectItem value="smtp">SMTP</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose your email service provider
                </p>
              </div>

              {/* API Key */}
              {config.provider !== 'mock' && (
                <div className="space-y-2">
                  <Label htmlFor="api-key">API Key</Label>
                  <Input
                    id="api-key"
                    type="password"
                    value={config.apiKey || ''}
                    onChange={(e) => handleConfigUpdate('apiKey', e.target.value)}
                    disabled={!config.enabled}
                    placeholder="Enter your API key"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your {getProviderLabel(config.provider)} API key
                  </p>
                </div>
              )}

              {/* Domain (for Mailgun) */}
              {config.provider === 'mailgun' && (
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    value={config.domain || ''}
                    onChange={(e) => handleConfigUpdate('domain', e.target.value)}
                    disabled={!config.enabled}
                    placeholder="your-domain.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Mailgun domain
                  </p>
                </div>
              )}

              {/* From Email */}
              <div className="space-y-2">
                <Label htmlFor="from-email">From Email</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={config.fromEmail}
                  onChange={(e) => handleConfigUpdate('fromEmail', e.target.value)}
                  disabled={!config.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Email address that will appear as sender
                </p>
              </div>

              {/* From Name */}
              <div className="space-y-2">
                <Label htmlFor="from-name">From Name</Label>
                <Input
                  id="from-name"
                  value={config.fromName}
                  onChange={(e) => handleConfigUpdate('fromName', e.target.value)}
                  disabled={!config.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Name that will appear as sender
                </p>
              </div>

              {/* Test Connection */}
              <div className="flex items-center space-x-4">
                <Button
                  onClick={handleTestConnection}
                  disabled={!config.enabled || isTesting}
                  variant="outline"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
                
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder="test@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="w-48"
                  />
                  <Button
                    onClick={handleSendTestEmail}
                    disabled={!testEmail || !config.enabled}
                    size="sm"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Test
                  </Button>
                </div>
              </div>

              {/* Status Alert */}
              {config.enabled ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Email service is enabled and ready to send notifications.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Email service is disabled. Enable it to send notifications.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Email Templates</h3>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              </div>

              <div className="space-y-4">
                {templates.map((template) => (
                  <Card key={template.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            {template.subject}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Variables: {template.variables.join(', ')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Email History</h3>
                <Badge variant="outline">
                  {notifications.length} total
                </Badge>
              </div>

              <div className="space-y-2">
                {notifications.slice(0, 10).map((notification) => (
                  <Card key={notification.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{notification.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            To: {notification.recipient}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {notification.sentAt ? new Date(notification.sentAt).toLocaleString() : 'Pending'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(notification.status)}
                          {notification.error && (
                            <Button variant="outline" size="sm">
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
