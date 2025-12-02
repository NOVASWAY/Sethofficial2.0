'use client'

import { useState, useEffect } from 'react'
import { Bell, AlertCircle, Info, AlertTriangle, CheckCircle, X, Pin, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { announcementsAPI, type Announcement } from '@/lib/api-client'
import { formatDistanceToNow, format } from 'date-fns'

interface AnnouncementsPanelProps {
  className?: string
  limit?: number
  showUnreadOnly?: boolean
}

export function AnnouncementsPanel({ 
  className, 
  limit = 10,
  showUnreadOnly = false 
}: AnnouncementsPanelProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadAnnouncements = async () => {
    setLoading(true)
    try {
      const [anns, count] = await Promise.all([
        announcementsAPI.getAll({ 
          includeAcknowledged: !showUnreadOnly,
          limit 
        }),
        announcementsAPI.getUnreadCount(),
      ])
      setAnnouncements(anns)
      setUnreadCount(count)
    } catch (error) {
      console.error('Failed to load announcements:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load announcements',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
    
    // Poll for new announcements every 60 seconds
    const interval = setInterval(loadAnnouncements, 60000)
    return () => clearInterval(interval)
  }, [showUnreadOnly, limit])

  const handleAcknowledge = async (announcementId: string) => {
    try {
      await announcementsAPI.acknowledge(announcementId)
      setAnnouncements(prev => 
        prev.map(a => a.id === announcementId 
          ? { ...a, is_acknowledged: true, acknowledged_at: new Date().toISOString() }
          : a
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      toast({
        title: 'Success',
        description: 'Announcement acknowledged',
      })
    } catch (error) {
      console.error('Failed to acknowledge announcement:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to acknowledge announcement',
      })
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'normal':
        return <Info className="h-4 w-4 text-blue-500" />
      case 'low':
        return <Info className="h-4 w-4 text-gray-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  const getPriorityBadgeVariant = (priority: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'urgent':
        return 'destructive'
      case 'high':
        return 'default'
      case 'normal':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const unreadAnnouncements = announcements.filter(a => !a.is_acknowledged)
  const displayAnnouncements = showUnreadOnly ? unreadAnnouncements : announcements

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Announcements
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadAnnouncements}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {loading && announcements.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading announcements...
            </div>
          ) : displayAnnouncements.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No announcements</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayAnnouncements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    !announcement.is_acknowledged 
                      ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' 
                      : 'bg-background'
                  } ${announcement.is_pinned ? 'border-2 border-yellow-400' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getPriorityIcon(announcement.priority)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {announcement.is_pinned && (
                              <Pin className="h-3 w-3 text-yellow-500" />
                            )}
                            <h4 className="font-semibold text-sm">
                              {announcement.title}
                            </h4>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {announcement.content}
                          </p>
                        </div>
                        {!announcement.is_acknowledged && (
                          <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={getPriorityBadgeVariant(announcement.priority)}
                            className="text-xs"
                          >
                            {announcement.priority}
                          </Badge>
                          {announcement.scope !== 'system' && (
                            <Badge variant="outline" className="text-xs">
                              {announcement.scope}
                            </Badge>
                          )}
                          {announcement.creator_name && (
                            <span className="text-xs text-muted-foreground">
                              by {announcement.creator_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {announcement.published_at && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(announcement.published_at), { addSuffix: true })}
                            </span>
                          )}
                          {announcement.requires_acknowledgment && !announcement.is_acknowledged && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAcknowledge(announcement.id)}
                              className="text-xs"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Acknowledge
                            </Button>
                          )}
                          {announcement.is_acknowledged && (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Acknowledged
                            </Badge>
                          )}
                        </div>
                      </div>
                      {announcement.expires_at && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Expires: {format(new Date(announcement.expires_at), 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

