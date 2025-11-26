'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Save, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { userPreferencesAPI } from '@/lib/api-client'
import { useAuth } from '@/contexts/auth-context'

interface UserPreferences {
  dashboardLayout: 'compact' | 'detailed' | 'custom'
  defaultView: 'overview' | 'patients' | 'appointments' | 'reports'
  showNotifications: boolean
  autoRefresh: boolean
  refreshInterval: number
  favoriteModules: string[]
  customMetrics: string[]
  theme: 'light' | 'dark' | 'auto'
  language: string
  timezone: string
}

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preferences: UserPreferences
  onPreferencesChange: (preferences: UserPreferences) => void
}

export function SettingsModal({ open, onOpenChange, preferences, onPreferencesChange }: SettingsModalProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [localPreferences, setLocalPreferences] = useState<UserPreferences>(preferences)

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        variant: 'error',
        title: 'Error',
        description: 'User not found',
      })
      return
    }

    setLoading(true)
    try {
      // Save to backend
      await userPreferencesAPI.update(user.id, localPreferences)
      
      // Update local state
      onPreferencesChange(localPreferences)
      
      // Also save to localStorage as backup
      localStorage.setItem(`user_preferences_${user.id}`, JSON.stringify(localPreferences))
      
      toast({
        title: 'Settings Saved',
        description: 'Your preferences have been saved successfully.',
      })
      
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving preferences:', error)
      // Fallback to localStorage only
      localStorage.setItem(`user_preferences_${user.id}`, JSON.stringify(localPreferences))
      onPreferencesChange(localPreferences)
      
      toast({
        title: 'Settings Saved Locally',
        description: 'Settings saved to local storage. Backend sync will be attempted later.',
      })
      
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Dashboard Settings
          </DialogTitle>
          <DialogDescription>
            Customize your dashboard layout, preferences, and notification settings
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dashboard Layout</Label>
                <Select
                  value={localPreferences.dashboardLayout}
                  onValueChange={(value: 'compact' | 'detailed' | 'custom') =>
                    setLocalPreferences(prev => ({ ...prev, dashboardLayout: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Default View</Label>
                <Select
                  value={localPreferences.defaultView}
                  onValueChange={(value: 'overview' | 'patients' | 'appointments' | 'reports') =>
                    setLocalPreferences(prev => ({ ...prev, defaultView: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overview">Overview</SelectItem>
                    <SelectItem value="patients">Patients</SelectItem>
                    <SelectItem value="appointments">Appointments</SelectItem>
                    <SelectItem value="reports">Reports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto Refresh</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically refresh dashboard data
                </p>
              </div>
              <Switch
                checked={localPreferences.autoRefresh}
                onCheckedChange={(checked) =>
                  setLocalPreferences(prev => ({ ...prev, autoRefresh: checked }))
                }
              />
            </div>

            {localPreferences.autoRefresh && (
              <div className="space-y-2">
                <Label>Refresh Interval (seconds)</Label>
                <Input
                  type="number"
                  min="10"
                  max="300"
                  value={localPreferences.refreshInterval}
                  onChange={(e) =>
                    setLocalPreferences(prev => ({ ...prev, refreshInterval: parseInt(e.target.value) || 30 }))
                  }
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Show Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Enable desktop and in-app notifications
                </p>
              </div>
              <Switch
                checked={localPreferences.showNotifications}
                onCheckedChange={(checked) =>
                  setLocalPreferences(prev => ({ ...prev, showNotifications: checked }))
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={localPreferences.theme}
                onValueChange={(value: 'light' | 'dark' | 'auto') =>
                  setLocalPreferences(prev => ({ ...prev, theme: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="auto">Auto (System)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={localPreferences.language}
                onValueChange={(value) =>
                  setLocalPreferences(prev => ({ ...prev, language: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="sw">Swahili</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={localPreferences.timezone}
                onValueChange={(value) =>
                  setLocalPreferences(prev => ({ ...prev, timezone: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Nairobi">Africa/Nairobi (EAT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

