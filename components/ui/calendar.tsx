'use client'

import * as React from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface CalendarProps {
  className?: string
  selected?: Date | { from?: Date; to?: Date }
  onSelect?: (date: Date | { from?: Date; to?: Date } | undefined) => void
  disabled?: (date: Date) => boolean
  mode?: 'single' | 'range'
  defaultMonth?: Date
}

function Calendar({
  className,
  selected,
  onSelect,
  disabled,
  mode = 'single',
  defaultMonth = new Date(),
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(defaultMonth)
  
  const today = new Date()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
  const firstDayOfWeek = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  const days = []
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null)
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(day)
  }
  
  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }
  
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }
  
  const handleDayClick = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    if (disabled && disabled(date)) return
    onSelect?.(date)
  }
  
  const isSelected = (day: number) => {
    if (!selected) return false
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    
    // Handle range mode
    if (mode === 'range' && typeof selected === 'object' && 'from' in selected) {
      const range = selected as { from?: Date; to?: Date }
      if (range.from) {
        const fromDate = range.from instanceof Date ? range.from : new Date(range.from)
        if (!isNaN(fromDate.getTime()) && date.toDateString() === fromDate.toDateString()) {
          return true
        }
      }
      if (range.to) {
        const toDate = range.to instanceof Date ? range.to : new Date(range.to)
        if (!isNaN(toDate.getTime()) && date.toDateString() === toDate.toDateString()) {
          return true
        }
      }
      // Check if date is in range
      if (range.from && range.to) {
        const fromDate = range.from instanceof Date ? range.from : new Date(range.from)
        const toDate = range.to instanceof Date ? range.to : new Date(range.to)
        if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
          return date >= fromDate && date <= toDate
        }
      }
      return false
    }
    
    // Handle single mode
    // Ensure selected is a Date object
    const selectedDate = selected instanceof Date ? selected : new Date(selected as any)
    // Check if selectedDate is valid
    if (isNaN(selectedDate.getTime())) return false
    return date.toDateString() === selectedDate.toDateString()
  }
  
  const isToday = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    return date.toDateString() === today.toDateString()
  }
  
  const isDisabled = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    return disabled ? disabled(date) : false
  }

  return (
    <div className={cn('bg-background p-3 rounded-md border', className)} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePreviousMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <div className="font-medium">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
            {day}
          </div>
        ))}
      </div>
      
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <div key={index} className="aspect-square">
            {day ? (
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 w-8 p-0 font-normal',
                  isSelected(day) && 'bg-primary text-primary-foreground',
                  isToday(day) && !isSelected(day) && 'bg-accent text-accent-foreground',
                  isDisabled(day) && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => handleDayClick(day)}
                disabled={isDisabled(day)}
              >
                {day}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarDayButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button className={cn('h-8 w-8 p-0', className)} {...props} />
}

export { Calendar, CalendarDayButton }
