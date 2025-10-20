"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Users, Calendar, DollarSign, Activity } from "lucide-react"

// Simple chart components (in a real app, you'd use Chart.js, Recharts, or similar)
interface ChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  title?: string
  description?: string
  loading?: boolean
  className?: string
}

export function BarChart({ data, title, description, loading, className }: ChartProps) {
  if (loading) {
    return <ChartSkeleton title={title} description={description} />
  }

  const maxValue = Math.max(...data.map(d => d.value))
  
  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="text-muted-foreground">{item.value}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function LineChart({ data, title, description, loading, className }: ChartProps) {
  if (loading) {
    return <ChartSkeleton title={title} description={description} />
  }

  const maxValue = Math.max(...data.map(d => d.value))
  const minValue = Math.min(...data.map(d => d.value))
  const range = maxValue - minValue

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="h-64 flex items-end justify-between space-x-1">
          {data.map((item, index) => {
            const height = range > 0 ? ((item.value - minValue) / range) * 100 : 50
            return (
              <div key={index} className="flex flex-col items-center space-y-2 flex-1">
                <div
                  className="w-full bg-primary rounded-t transition-all duration-500 ease-out"
                  style={{
                    height: `${height}%`,
                    minHeight: '4px',
                    backgroundColor: item.color
                  }}
                />
                <span className="text-xs text-muted-foreground text-center">
                  {item.label}
                </span>
                <span className="text-xs font-medium">
                  {item.value}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function PieChart({ data, title, description, loading, className }: ChartProps) {
  if (loading) {
    return <ChartSkeleton title={title} description={description} />
  }

  const total = data.reduce((sum, item) => sum + item.value, 0)
  let cumulativePercentage = 0

  return (
    <Card className={className}>
      {title && (
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          <div className="h-48 w-48 mx-auto relative">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              {data.map((item, index) => {
                const percentage = (item.value / total) * 100
                const startAngle = (cumulativePercentage / 100) * 360
                const endAngle = ((cumulativePercentage + percentage) / 100) * 360
                cumulativePercentage += percentage

                const startAngleRad = (startAngle * Math.PI) / 180
                const endAngleRad = (endAngle * Math.PI) / 180

                const x1 = 50 + 40 * Math.cos(startAngleRad)
                const y1 = 50 + 40 * Math.sin(startAngleRad)
                const x2 = 50 + 40 * Math.cos(endAngleRad)
                const y2 = 50 + 40 * Math.sin(endAngleRad)

                const largeArcFlag = percentage > 50 ? 1 : 0

                const pathData = [
                  `M 50 50`,
                  `L ${x1} ${y1}`,
                  `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                  `Z`
                ].join(' ')

                return (
                  <path
                    key={index}
                    d={pathData}
                    fill={item.color || `hsl(${index * 60}, 70%, 50%)`}
                    className="transition-all duration-300 hover:opacity-80"
                  />
                )
              })}
            </svg>
          </div>
          <div className="space-y-2">
            {data.map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color || `hsl(${index * 60}, 70%, 50%)` }}
                />
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm text-muted-foreground ml-auto">
                  {item.value} ({((item.value / total) * 100).toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Metric cards
interface MetricCardProps {
  title: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: React.ReactNode
  loading?: boolean
  className?: string
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  changeLabel, 
  icon, 
  loading, 
  className 
}: MetricCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const isPositive = change && change > 0
  const isNegative = change && change < 0

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change !== undefined && (
              <div className="flex items-center space-x-1">
                {isPositive && <TrendingUp className="h-3 w-3 text-green-600" />}
                {isNegative && <TrendingDown className="h-3 w-3 text-red-600" />}
                <span className={`text-xs font-medium ${
                  isPositive ? 'text-green-600' : 
                  isNegative ? 'text-red-600' : 
                  'text-muted-foreground'
                }`}>
                  {change > 0 ? '+' : ''}{change}%
                </span>
                {changeLabel && (
                  <span className="text-xs text-muted-foreground">
                    {changeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          {icon && (
            <div className="h-8 w-8 text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Chart skeleton
function ChartSkeleton({ title, description }: { title?: string; description?: string }) {
  return (
    <Card>
      {title && (
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Common chart data generators
export const generateMonthlyData = (months: string[], values: number[]) => {
  return months.map((month, index) => ({
    label: month,
    value: values[index] || 0,
    color: `hsl(${index * 30}, 70%, 50%)`
  }))
}

export const generateStatusData = (statuses: Array<{ name: string; count: number; color?: string }>) => {
  return statuses.map(status => ({
    label: status.name,
    value: status.count,
    color: status.color
  }))
}

// Predefined icons for common metrics
export const MetricIcons = {
  users: <Users className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  dollar: <DollarSign className="h-4 w-4" />,
  activity: <Activity className="h-4 w-4" />,
  trendingUp: <TrendingUp className="h-4 w-4" />,
  trendingDown: <TrendingDown className="h-4 w-4" />,
}
