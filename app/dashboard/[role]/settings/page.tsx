"use client"

import { useState, useRef } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings, User, Bell, Shield, Database, Save, RefreshCw, Download, Upload, CheckCircle2 } from "lucide-react"
import { useParams } from "next/navigation"
import { useSettings } from "@/contexts/settings-context"
import { useToast } from "@/hooks/use-toast"
import { ProfilePictureUpload } from "@/components/profile-picture-upload"
import { BackupScheduler } from "@/components/backup-scheduler"
import { EmailSettings } from "@/components/email-settings"
import { SMSSettings } from "@/components/sms-settings"

export default function SettingsPage() {
  const params = useParams()
  const role = params.role as string
  const { settings, userProfile, securitySettings, updateSettings, updateUserProfile, updateSecuritySettings, changePassword, updateProfilePicture, exportBackup, importBackup } = useSettings()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Local state for forms
  const [generalForm, setGeneralForm] = useState(settings)
  const [profileForm, setProfileForm] = useState(userProfile || {
    name: '',
    phone: '',
    role: '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: settings.emailNotifications,
    smsNotifications: settings.smsNotifications,
    appointmentReminders: settings.appointmentReminders,
    lowStockAlerts: settings.lowStockAlerts,
    expiryAlerts: settings.expiryAlerts,
    systemUpdates: settings.systemUpdates,
  })
  const [securityForm, setSecurityForm] = useState(securitySettings)

  const handleSaveGeneralSettings = async () => {
    try {
      await updateSettings(generalForm)
      toast({
        title: "Settings Saved",
        description: "General settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSaveProfile = () => {
    updateUserProfile(profileForm)
    toast({
      title: "Profile Updated",
      description: "Your profile information has been saved.",
    })
  }

  const handleSaveNotifications = async () => {
    try {
      await updateSettings(notificationPrefs)
      toast({
        title: "Preferences Saved",
        description: "Notification preferences have been updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save notification preferences. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New passwords do not match",
        variant: "error",
      })
      return
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters long",
        variant: "error",
      })
      return
    }

    const success = await changePassword(passwordForm.currentPassword, passwordForm.newPassword)
    
    if (success) {
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully.",
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } else {
      toast({
        title: "Error",
        description: "Failed to change password. Please check your current password.",
        variant: "error",
      })
    }
  }

  const handleSaveSecuritySettings = () => {
    updateSecuritySettings(securityForm)
    toast({
      title: "Security Settings Updated",
      description: "Your security preferences have been saved.",
    })
  }

  const handleExportBackup = () => {
    const backupData = exportBackup()
    const blob = new Blob([backupData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clinic-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Backup Created",
      description: "System backup has been downloaded successfully.",
    })
  }

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const jsonData = e.target?.result as string
        const success = importBackup(jsonData)
        
        if (success) {
          toast({
            title: "Backup Restored",
            description: "System has been restored from backup. Please reload the page.",
          })
          
          // Reload after 2 seconds
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else {
          throw new Error('Invalid backup file')
        }
      } catch (error) {
        toast({
          title: "Restore Failed",
          description: "Failed to restore from backup. Please check the file format.",
          variant: "error",
        })
      }
    }
    reader.readAsText(file)
  }

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Manage system configuration and preferences</p>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="w-5 h-5" />
                  <span>General Settings</span>
                </CardTitle>
                <CardDescription>Configure basic system settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="clinic-name">Clinic Name</Label>
                  <Input 
                    id="clinic-name" 
                    value={generalForm.clinicName}
                    onChange={(e) => setGeneralForm({ ...generalForm, clinicName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinic-address">Address</Label>
                  <Input 
                    id="clinic-address" 
                    value={generalForm.clinicAddress}
                    onChange={(e) => setGeneralForm({ ...generalForm, clinicAddress: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      value={generalForm.phone}
                      onChange={(e) => setGeneralForm({ ...generalForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email" 
                      value={generalForm.email}
                      onChange={(e) => setGeneralForm({ ...generalForm, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="working-hours">Working Hours</Label>
                  <Input 
                    id="working-hours" 
                    value={generalForm.workingHours}
                    onChange={(e) => setGeneralForm({ ...generalForm, workingHours: e.target.value })}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select 
                    value={generalForm.language} 
                    onValueChange={(value) => setGeneralForm({ ...generalForm, language: value as any })}
                  >
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="swahili">Swahili</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select 
                    value={generalForm.currency} 
                    onValueChange={(value) => setGeneralForm({ ...generalForm, currency: value as any })}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KSh">KSh (Kenyan Shilling)</SelectItem>
                      <SelectItem value="USD">USD (US Dollar)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleSaveGeneralSettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-4">
            {/* Profile Picture Upload */}
            <ProfilePictureUpload
              currentAvatar={userProfile?.avatar}
              userName={userProfile?.name || 'User'}
              onAvatarChange={updateProfilePicture}
              className="max-w-sm mx-auto"
            />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Profile Settings</span>
                </CardTitle>
                <CardDescription>Manage your personal profile information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Full Name</Label>
                  <Input 
                    id="profile-name" 
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email Address</Label>
                  <Input 
                    id="profile-email" 
                    value={profileForm.email || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-phone">Phone Number</Label>
                  <Input 
                    id="profile-phone" 
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input 
                    id="department" 
                    value={profileForm.department || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="license">License Number</Label>
                  <Input 
                    id="license" 
                    value={profileForm.licenseNumber || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, licenseNumber: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Input 
                    id="bio" 
                    value={profileForm.bio || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    placeholder="Brief description about yourself"
                  />
                </div>

                <Button onClick={handleSaveProfile}>
                  <Save className="w-4 h-4 mr-2" />
                  Update Profile
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="w-5 h-5" />
                  <span>Notification Settings</span>
                </CardTitle>
                <CardDescription>Configure how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch 
                    checked={notificationPrefs.emailNotifications}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, emailNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
                  </div>
                  <Switch 
                    checked={notificationPrefs.smsNotifications}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, smsNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Appointment Reminders</Label>
                    <p className="text-sm text-muted-foreground">Get reminded about upcoming appointments</p>
                  </div>
                  <Switch 
                    checked={notificationPrefs.appointmentReminders}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, appointmentReminders: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Low Stock Alerts</Label>
                    <p className="text-sm text-muted-foreground">Alert when inventory is running low</p>
                  </div>
                  <Switch 
                    checked={notificationPrefs.lowStockAlerts}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, lowStockAlerts: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Expiry Alerts</Label>
                    <p className="text-sm text-muted-foreground">Alert when medicines are about to expire</p>
                  </div>
                  <Switch 
                    checked={notificationPrefs.expiryAlerts}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, expiryAlerts: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>System Updates</Label>
                    <p className="text-sm text-muted-foreground">Notifications about system updates</p>
                  </div>
                  <Switch 
                    checked={notificationPrefs.systemUpdates}
                    onCheckedChange={(checked) => setNotificationPrefs({ ...notificationPrefs, systemUpdates: checked })}
                  />
                </div>

                <Button onClick={handleSaveNotifications}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Security Settings</span>
                </CardTitle>
                <CardDescription>Manage security and access controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-medium">Change Password</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input 
                      id="current-password" 
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input 
                      id="new-password" 
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input 
                      id="confirm-password" 
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    />
                  </div>

                  <Button onClick={handleChangePassword}>
                    <Save className="w-4 h-4 mr-2" />
                    Change Password
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Switch 
                    checked={securityForm.twoFactorEnabled}
                    onCheckedChange={(checked) => setSecurityForm({ ...securityForm, twoFactorEnabled: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                  <Input 
                    id="session-timeout" 
                    type="number"
                    value={securityForm.sessionTimeout}
                    onChange={(e) => setSecurityForm({ ...securityForm, sessionTimeout: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password-expiry">Password Expiry (days)</Label>
                  <Input 
                    id="password-expiry" 
                    type="number"
                    value={securityForm.passwordExpiry}
                    onChange={(e) => setSecurityForm({ ...securityForm, passwordExpiry: parseInt(e.target.value) })}
                  />
                </div>

                <Button onClick={handleSaveSecuritySettings}>
                  <Save className="w-4 h-4 mr-2" />
                  Update Security
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System */}
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>System Settings</span>
                </CardTitle>
                <CardDescription>Configure system-wide settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Automatic Backups</Label>
                    <p className="text-sm text-muted-foreground">Schedule regular data backups</p>
                  </div>
                  <Switch 
                    checked={settings.autoBackup}
                    onCheckedChange={(checked) => updateSettings({ autoBackup: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backup-frequency">Backup Frequency</Label>
                  <Select 
                    value={settings.backupFrequency} 
                    onValueChange={(value) => updateSettings({ backupFrequency: value as any })}
                  >
                    <SelectTrigger id="backup-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">Temporarily disable system access</p>
                  </div>
                  <Switch 
                    checked={settings.maintenanceMode}
                    onCheckedChange={(checked) => {
                      updateSettings({ maintenanceMode: checked })
                      toast({
                        title: checked ? "Maintenance Mode Enabled" : "Maintenance Mode Disabled",
                        description: checked ? "System is now in maintenance mode" : "System is now accessible",
                      })
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>API Logging</Label>
                    <p className="text-sm text-muted-foreground">Track all API requests</p>
                  </div>
                  <Switch 
                    checked={settings.apiLogging}
                    onCheckedChange={(checked) => updateSettings({ apiLogging: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>System Version</Label>
                    <p className="text-sm text-muted-foreground">Current system version</p>
                  </div>
                  <Badge variant="outline">v2.1.0</Badge>
                </div>

                <Separator />

                <div className="flex items-center space-x-2">
                  <Button variant="outline" onClick={() => toast({ title: "Up to Date", description: "You're running the latest version." })}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Check for Updates
                  </Button>
                  <Button variant="outline" onClick={() => toast({ title: "Maintenance Scheduled", description: "System maintenance will run at 2:00 AM" })}>
                    <Database className="w-4 h-4 mr-2" />
                    System Maintenance
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Settings */}
          <TabsContent value="email" className="space-y-4">
            <EmailSettings />
          </TabsContent>

          {/* SMS Settings */}
          <TabsContent value="sms" className="space-y-4">
            <SMSSettings />
          </TabsContent>

          {/* Backup */}
          <TabsContent value="backup" className="space-y-4">
            {/* Auto Backup Scheduler */}
            <BackupScheduler />
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>Backup & Restore</span>
                </CardTitle>
                <CardDescription>Manage data backups and system restore</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Last Backup</Label>
                    <p className="text-sm text-muted-foreground">
                      {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge className="bg-green-500">Successful</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Backup Frequency</Label>
                    <p className="text-sm text-muted-foreground">How often to create backups</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{settings.backupFrequency}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Backup Storage</Label>
                    <p className="text-sm text-muted-foreground">Where backups are stored</p>
                  </div>
                  <Badge variant="outline">Local Storage</Badge>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={handleExportBackup}>
                    <Download className="w-4 h-4 mr-2" />
                    Create Backup
                  </Button>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Restore from Backup
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportBackup}
                  />
                </div>

                <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Important:</strong> Backups include all patient data, appointments, inventory, financial records, and system settings. 
                    Store backups securely and ensure they are backed up regularly to prevent data loss.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
