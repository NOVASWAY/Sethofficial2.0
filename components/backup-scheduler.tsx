'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Clock, 
  Play, 
  Pause, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Calendar,
  HardDrive,
  Settings
} from 'lucide-react'
import { useBackupScheduler, type BackupInterval } from '@/contexts/backup-scheduler-context'
import { useTranslation } from '@/contexts/language-context'

export function BackupScheduler() {
  const { t } = useTranslation()
  const { 
    schedule, 
    updateSchedule, 
    isBackupRunning, 
    triggerBackup, 
    getBackupStatus 
  } = useBackupScheduler()
  
  const [isExpanded, setIsExpanded] = useState(false)
  
  const backupStatus = getBackupStatus()

  const handleIntervalChange = (interval: BackupInterval) => {
    updateSchedule({ interval })
  }

  const handleTimeChange = (time: string) => {
    updateSchedule({ time })
  }

  const handleMaxBackupsChange = (maxBackups: number) => {
    updateSchedule({ maxBackups })
  }

  const handleToggleEnabled = (enabled: boolean) => {
    updateSchedule({ enabled })
  }

  const getStatusBadge = () => {
    switch (backupStatus.status) {
      case 'running':
        return <Badge variant="default" className="bg-blue-500">Running</Badge>
      case 'scheduled':
        return <Badge variant="default" className="bg-green-500">Scheduled</Badge>
      case 'idle':
        return <Badge variant="outline">Idle</Badge>
      case 'disabled':
        return <Badge variant="secondary">Disabled</Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getIntervalLabel = (interval: BackupInterval) => {
    switch (interval) {
      case 'hourly': return 'Every Hour'
      case 'daily': return 'Daily'
      case 'weekly': return 'Weekly'
      case 'monthly': return 'Monthly'
      case 'disabled': return 'Disabled'
      default: return interval
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <HardDrive className="h-5 w-5" />
            <div>
              <CardTitle>Auto Backup Scheduler</CardTitle>
              <CardDescription>
                Configure automatic backup intervals and settings
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge()}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {isExpanded ? 'Hide' : 'Configure'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Next Backup</p>
              <p className="text-xs text-muted-foreground">
                {backupStatus.nextBackup || 'Not scheduled'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Last Backup</p>
              <p className="text-xs text-muted-foreground">
                {backupStatus.lastBackup || 'Never'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Interval</p>
              <p className="text-xs text-muted-foreground">
                {getIntervalLabel(schedule.interval)}
              </p>
            </div>
          </div>
        </div>

        {/* Manual Backup */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Manual Backup</p>
            <p className="text-sm text-muted-foreground">
              Create a backup immediately
            </p>
          </div>
          <Button
            onClick={triggerBackup}
            disabled={isBackupRunning}
            className="flex items-center space-x-2"
          >
            {isBackupRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Create Backup</span>
              </>
            )}
          </Button>
        </div>

        {/* Progress Bar for Running Backup */}
        {isBackupRunning && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Creating backup...</span>
              <span>Please wait</span>
            </div>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {/* Configuration Panel */}
        {isExpanded && (
          <div className="space-y-6 pt-4 border-t">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-backup">Enable Auto Backup</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically create backups at scheduled intervals
                </p>
              </div>
              <Switch
                id="enable-backup"
                checked={schedule.enabled}
                onCheckedChange={handleToggleEnabled}
              />
            </div>

            {/* Backup Interval */}
            <div className="space-y-2">
              <Label htmlFor="backup-interval">Backup Interval</Label>
              <Select
                value={schedule.interval}
                onValueChange={handleIntervalChange}
                disabled={!schedule.enabled}
              >
                <SelectTrigger id="backup-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Every Hour</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Backup Time (for daily/weekly/monthly) */}
            {(schedule.interval === 'daily' || schedule.interval === 'weekly' || schedule.interval === 'monthly') && (
              <div className="space-y-2">
                <Label htmlFor="backup-time">Backup Time</Label>
                <Input
                  id="backup-time"
                  type="time"
                  value={schedule.time || '02:00'}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  disabled={!schedule.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Choose the time when backups should be created
                </p>
              </div>
            )}

            {/* Max Backups */}
            <div className="space-y-2">
              <Label htmlFor="max-backups">Maximum Backups to Keep</Label>
              <Input
                id="max-backups"
                type="number"
                min="1"
                max="100"
                value={schedule.maxBackups}
                onChange={(e) => handleMaxBackupsChange(parseInt(e.target.value) || 30)}
                disabled={!schedule.enabled}
              />
              <p className="text-xs text-muted-foreground">
                Older backups will be automatically deleted when this limit is reached
              </p>
            </div>

            {/* Status Alert */}
            {schedule.enabled && backupStatus.nextBackup && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Next backup is scheduled for {backupStatus.nextBackup}
                </AlertDescription>
              </Alert>
            )}

            {!schedule.enabled && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Auto backup is currently disabled. Enable it to start automatic backups.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
