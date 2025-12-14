'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarIcon, Filter, X } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { DateRange as RDDateRange } from 'react-day-picker'

export type DateRange = RDDateRange

interface DateRangeFilterProps {
  onDateRangeChange: (range: RDDateRange) => void
  className?: string
  placeholder?: string
  showPresets?: boolean
}

const PRESET_RANGES = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last7days' },
  { label: 'Last 30 days', value: 'last30days' },
  { label: 'This month', value: 'thismonth' },
  { label: 'Last month', value: 'lastmonth' },
  { label: 'This year', value: 'thisyear' },
  { label: 'All time', value: 'alltime' },
]

export function DateRangeFilter({ 
  onDateRangeChange, 
  className = '',
  placeholder = 'Select date range',
  showPresets = true
}: DateRangeFilterProps) {
  const [dateRange, setDateRange] = useState<RDDateRange>({ from: undefined, to: undefined })
  const [isOpen, setIsOpen] = useState(false)
  const [preset, setPreset] = useState<string>('')

  const handleDateRangeChange = (range: RDDateRange) => {
    setDateRange(range)
    onDateRangeChange(range)
  }

  const handlePresetChange = (value: string) => {
    setPreset(value)
    const today = new Date()
    let from: Date | undefined
    let to: Date | undefined

    switch (value) {
      case 'today':
        from = new Date(today)
        to = new Date(today)
        break
      case 'yesterday':
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        from = yesterday
        to = yesterday
        break
      case 'last7days':
        from = new Date(today)
        from.setDate(from.getDate() - 7)
        to = today
        break
      case 'last30days':
        from = new Date(today)
        from.setDate(from.getDate() - 30)
        to = today
        break
      case 'thismonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1)
        to = today
        break
      case 'lastmonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        from = lastMonth
        to = new Date(today.getFullYear(), today.getMonth(), 0)
        break
      case 'thisyear':
        from = new Date(today.getFullYear(), 0, 1)
        to = today
        break
      case 'alltime':
        from = undefined
        to = undefined
        break
    }

    const newRange: RDDateRange = { from, to }
    setDateRange(newRange)
    onDateRangeChange(newRange)
  }

  const clearFilter = () => {
    const newRange: RDDateRange = { from: undefined, to: undefined }
    setDateRange(newRange)
    setPreset('')
    onDateRangeChange(newRange)
  }

  const formatDateRange = () => {
    if (!dateRange.from && !dateRange.to) {
      return placeholder
    }
    
    if (dateRange.from && dateRange.to) {
      if (dateRange.from.getTime() === dateRange.to.getTime()) {
        return format(dateRange.from, 'MMM dd, yyyy')
      }
      return `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
    }
    
    if (dateRange.from) {
      return `From ${format(dateRange.from, 'MMM dd, yyyy')}`
    }
    
    if (dateRange.to) {
      return `Until ${format(dateRange.to, 'MMM dd, yyyy')}`
    }
    
    return placeholder
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'justify-start text-left font-normal',
              !dateRange.from && !dateRange.to && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateRange()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets */}
            {showPresets && (
              <div className="border-r p-3">
                <Label className="text-sm font-medium">Presets</Label>
                <Select value={preset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="w-32 mt-2">
                    <SelectValue placeholder="Select preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_RANGES.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Calendar */}
            <div className="p-3">
              <Label className="text-sm font-medium">Custom Range</Label>
              <Calendar
                mode="range"
                selected={dateRange as any}
                onSelect={(range) => {
                  const r = range as RDDateRange | undefined
                  if (r) {
                    handleDateRangeChange(r)
                  }
                }}
                className="mt-2"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilter}
              disabled={!dateRange.from && !dateRange.to}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Filter indicator */}
      {(dateRange.from || dateRange.to) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilter}
          className="h-8 px-2"
        >
          <Filter className="h-4 w-4 mr-1" />
          <span className="text-xs">Filtered</span>
        </Button>
      )}
    </div>
  )
}

// Utility function to check if a date is within range
export const isDateInRange = (date: Date | string, range: DateRange): boolean => {
  if (!range.from && !range.to) return true
  
  const checkDate = typeof date === 'string' ? new Date(date) : date
  
  if (range.from && range.to) {
    return checkDate >= range.from && checkDate <= range.to
  }
  
  if (range.from) {
    return checkDate >= range.from
  }
  
  if (range.to) {
    return checkDate <= range.to
  }
  
  return true
}

// Utility function to get date range label
export const getDateRangeLabel = (range: DateRange): string => {
  if (!range.from && !range.to) return 'All time'
  
  if (range.from && range.to) {
    if (range.from.getTime() === range.to.getTime()) {
      return format(range.from, 'MMM dd, yyyy')
    }
    return `${format(range.from, 'MMM dd')} - ${format(range.to, 'MMM dd, yyyy')}`
  }
  
  if (range.from) {
    return `From ${format(range.from, 'MMM dd, yyyy')}`
  }
  
  if (range.to) {
    return `Until ${format(range.to, 'MMM dd, yyyy')}`
  }
  
  return 'All time'
}
