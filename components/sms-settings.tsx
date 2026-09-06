'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { 
  MessageSquare, 
  Settings, 
  TestTube, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Eye,
  Edit,
  Trash2,
  Plus,
  CreditCard,
  Smartphone
} from 'lucide-react'
import { useTranslation } from '@/contexts/language-context'

interface SMSProviderConfig {
  enabled: boolean
  provider: 'africas_talking' | 'twilio' | 'mock'
  apiKey: string
  username: string
  accountSid: string
  authToken: string
  fromNumber: string
}

interface SMSTemplate {
  id: string
  name: string
  content: string
  type: string
  variables: string[]
}

interface SMSNotification {
  id: string
  recipient: string
  content: string
  status: 'sent' | 'delivered' | 'failed' | 'pending'
  sentAt?: string
  cost?: number
  error?: string
}

export function SMSSettings() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<SMSProviderConfig>({
    enabled: false,
    provider: 'mock',
    apiKey: '',
    username: '',
    accountSid: '',
    authToken: '',
    fromNumber: '',
  })
  const [templates, setTemplates] = useState<SMSTemplate[]>([])
  const [notifications, setNotifications] = useState<SMSNotification[]>([])
  
  const [isTesting, setIsTesting] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [activeTab, setActiveTab] = useState('config')
  const [balance, setBalance] = useState<number | null>(null)

  const updateConfig = (updates: Partial<SMSProviderConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  const sendSMS = async (to: string, message: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, message }),
      })
      const notification: SMSNotification = {
        id: `sms-${Date.now()}`,
        recipient: to,
        content: message,
        status: response.ok ? 'sent' : 'failed',
        sentAt: new Date().toISOString(),
      }
      setNotifications(prev => [notification, ...prev])
      return response.ok
    } catch (error) {
      const notification: SMSNotification = {
        id: `sms-${Date.now()}`,
        recipient: to,
        content: message,
        status: 'failed',
        sentAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      }
      setNotifications(prev => [notification, ...prev])
      return false
    }
  }

  const sendTemplateSMS = async (to: string, templateId: string, variables: Record<string, string>): Promise<boolean> => {
    const template = templates.find(t => t.id === templateId)
    if (!template) return false
    let content = template.content
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
    }
    return sendSMS(to, content)
  }

  const addTemplate = (template: Omit<SMSTemplate, 'id'>) => {
    setTemplates(prev => [...prev, { ...template, id: `template-${Date.now()}` }])
  }

  const updateTemplate = (id: string, updates: Partial<SMSTemplate>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const deleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const testSMSConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      return response.ok
    } catch (error) {
      return false
    }
  }

  const getSMSBalance = async (): Promise<number> => {
    try {
      const response = await fetch('/api/sms/balance')
      if (response.ok) {
        const data = await response.json()
        return data.balance || 0
      }
    } catch (error) {
      console.warn('Failed to fetch SMS balance:', error)
    }
    return 0
  }

  // Load balance on mount
  useEffect(() => {
    if (config.enabled) {
      getSMSBalance().then(setBalance)
    }
  }, [config.enabled, getSMSBalance])

  const handleConfigUpdate = (field: keyof typeof config, value: any) => {
    updateConfig({ [field]: value })
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    const success = await testSMSConnection()
    if (success) {
      const newBalance = await getSMSBalance()
      setBalance(newBalance)
    }
    setIsTesting(false)
  }

  const handleSendTestSMS = async () => {
    if (!testPhone || !testMessage) return
    
    const success = await sendSMS(testPhone, testMessage)
    
    if (success) {
      setTestPhone('')
      setTestMessage('')
    }
  }

  const getProviderLabel = (provider: SMSProviderConfig['provider']) => {
    switch (provider) {
      case 'africas_talking': return "Africa's Talking"
      case 'twilio': return 'Twilio'
      case 'mock': return 'Mock (Development)'
      default: return provider
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500">Sent</Badge>
      case 'delivered':
        return <Badge variant="default" className="bg-blue-500">Delivered</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'pending':
        return <Badge variant="outline">Pending</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatPhoneNumber = (phone: string) => {
    // Format phone number for display
    if (phone.startsWith('+254')) {
      return phone.replace(/(\+254)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
    } else if (phone.startsWith('0')) {
      return phone.replace(/(0)(\d{3})(\d{3})(\d{3})/, '$1 $2 $3 $4')
    }
    return phone
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>SMS Service Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure SMS service settings for notifications and alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
              <TabsTrigger value="balance">Balance</TabsTrigger>
            </TabsList>

            {/* Configuration Tab */}
            <TabsContent value="config" className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-sms">Enable SMS Service</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable SMS notifications and alerts
                  </p>
                </div>
                <Switch
                  id="enable-sms"
                  checked={config.enabled}
                  onCheckedChange={(enabled) => handleConfigUpdate('enabled', enabled)}
                />
              </div>

              {/* SMS Provider */}
              <div className="space-y-2">
                <Label htmlFor="sms-provider">SMS Provider</Label>
                <Select
                  value={config.provider}
                  onValueChange={(value) => handleConfigUpdate('provider', value as SMSProviderConfig['provider'])}
                  disabled={!config.enabled}
                >
                  <SelectTrigger id="sms-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mock">Mock (Development)</SelectItem>
                    <SelectItem value="africas_talking">Africa's Talking</SelectItem>
                    <SelectItem value="twilio">Twilio</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose your SMS service provider
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

              {/* Username (for Africa's Talking) */}
              {config.provider === 'africas_talking' && (
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={config.username || ''}
                    onChange={(e) => handleConfigUpdate('username', e.target.value)}
                    disabled={!config.enabled}
                    placeholder="Enter your username"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Africa's Talking username
                  </p>
                </div>
              )}

              {/* Account SID (for Twilio) */}
              {config.provider === 'twilio' && (
                <div className="space-y-2">
                  <Label htmlFor="account-sid">Account SID</Label>
                  <Input
                    id="account-sid"
                    value={config.accountSid || ''}
                    onChange={(e) => handleConfigUpdate('accountSid', e.target.value)}
                    disabled={!config.enabled}
                    placeholder="Enter your Account SID"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Twilio Account SID
                  </p>
                </div>
              )}

              {/* Auth Token (for Twilio) */}
              {config.provider === 'twilio' && (
                <div className="space-y-2">
                  <Label htmlFor="auth-token">Auth Token</Label>
                  <Input
                    id="auth-token"
                    type="password"
                    value={config.authToken || ''}
                    onChange={(e) => handleConfigUpdate('authToken', e.target.value)}
                    disabled={!config.enabled}
                    placeholder="Enter your Auth Token"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Twilio Auth Token
                  </p>
                </div>
              )}

              {/* From Number */}
              <div className="space-y-2">
                <Label htmlFor="from-number">From Number</Label>
                <Input
                  id="from-number"
                  value={config.fromNumber}
                  onChange={(e) => handleConfigUpdate('fromNumber', e.target.value)}
                  disabled={!config.enabled}
                  placeholder="+254700000000"
                />
                <p className="text-xs text-muted-foreground">
                  Phone number that will appear as sender (Kenyan format)
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
              </div>

              {/* Test SMS */}
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium">Send Test SMS</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="test-phone">Phone Number</Label>
                    <Input
                      id="test-phone"
                      placeholder="+254700000000"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="test-message">Message</Label>
                    <Input
                      id="test-message"
                      placeholder="Test message"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSendTestSMS}
                  disabled={!testPhone || !testMessage || !config.enabled}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Test SMS
                </Button>
              </div>

              {/* Status Alert */}
              {config.enabled ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    SMS service is enabled and ready to send notifications.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    SMS service is disabled. Enable it to send notifications.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">SMS Templates</h3>
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
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="font-medium">{template.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {template.type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {template.content}
                          </p>
                          <p className="text-xs text-muted-foreground">
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
                <h3 className="text-lg font-medium">SMS History</h3>
                <Badge variant="outline">
                  {notifications.length} total
                </Badge>
              </div>

              <div className="space-y-2">
                {notifications.slice(0, 10).map((notification) => (
                  <Card key={notification.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{formatPhoneNumber(notification.recipient)}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {notification.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.sentAt ? new Date(notification.sentAt).toLocaleString() : 'Pending'}
                            {notification.cost && ` • Cost: KES ${notification.cost}`}
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

            {/* Balance Tab */}
            <TabsContent value="balance" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">SMS Balance</h3>
                <Button 
                  onClick={() => getSMSBalance().then(setBalance)}
                  disabled={!config.enabled}
                  variant="outline"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-full">
                      <Smartphone className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {balance !== null ? `${balance} SMS` : 'Loading...'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Available SMS credits
                      </p>
                    </div>
                  </div>
                  
                  {config.provider !== 'mock' && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> This is a mock balance. In production, this would show your actual SMS credits from {getProviderLabel(config.provider)}.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
