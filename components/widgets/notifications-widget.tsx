"use client"

import { Bell, AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react"

interface Notification {
  id: string
  subject: string
  content: string
  priority: "low" | "normal" | "high" | "urgent"
  createdAt: string
}

interface NotificationsWidgetProps {
  notifications: Notification[]
  className?: string
}

export function NotificationsWidget({ notifications, className }: NotificationsWidgetProps) {
  const getPriorityIcon = (priority: string) => {
    const icons: Record<string, React.ReactNode> = {
      low: <Info className="w-4 h-4 text-blue-500" />,
      normal: <Bell className="w-4 h-4 text-muted-foreground" />,
      high: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
      urgent: <XCircle className="w-4 h-4 text-red-500" />,
    }
    return icons[priority] || icons.normal
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: "border-l-blue-500",
      normal: "border-l-gray-300",
      high: "border-l-yellow-500",
      urgent: "border-l-red-500",
    }
    return colors[priority] || colors.normal
  }

  return (
    <div className={`bg-card rounded-xl border border-border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-card-foreground">Notifications</h3>
        <Bell className="w-5 h-5 text-gray-400" />
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.slice(0, 5).map((notification) => (
            <div
              key={notification.id}
              className={`p-3 bg-muted rounded-lg border-l-4 ${getPriorityColor(notification.priority)}`}
            >
              <div className="flex items-start gap-2">
                {getPriorityIcon(notification.priority)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">
                    {notification.subject}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {notification.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
