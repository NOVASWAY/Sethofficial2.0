"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import {
  Search,
  Filter,
  X,
  Calendar as CalendarIcon,
  ChevronDown,
  RotateCcw
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export interface SearchFilter {
  field: string
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in' | 'notIn'
  value: any
  label: string
}

export interface SearchField {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect'
  options?: Array<{ value: string; label: string }>
  placeholder?: string
}

interface AdvancedSearchProps {
  fields: SearchField[]
  onSearch: (filters: SearchFilter[]) => void
  onClear: () => void
  className?: string
  placeholder?: string
  showQuickFilters?: boolean
  quickFilters?: Array<{ label: string; filters: SearchFilter[] }>
}

export function AdvancedSearch({
  fields,
  onSearch,
  onClear,
  className,
  placeholder = "Search...",
  showQuickFilters = true,
  quickFilters = []
}: AdvancedSearchProps) {
  const { toast } = useToast()
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [filters, setFilters] = React.useState<SearchFilter[]>([])
  const [selectedField, setSelectedField] = React.useState<string>("")
  const [selectedOperator, setSelectedOperator] = React.useState<string>("")
  const [filterValue, setFilterValue] = React.useState<any>("")
  const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>({})

  const operators = {
    text: [
      { value: 'contains', label: 'Contains' },
      { value: 'equals', label: 'Equals' },
      { value: 'startsWith', label: 'Starts with' },
      { value: 'endsWith', label: 'Ends with' }
    ],
    number: [
      { value: 'equals', label: 'Equals' },
      { value: 'greaterThan', label: 'Greater than' },
      { value: 'lessThan', label: 'Less than' },
      { value: 'between', label: 'Between' }
    ],
    date: [
      { value: 'equals', label: 'On date' },
      { value: 'greaterThan', label: 'After' },
      { value: 'lessThan', label: 'Before' },
      { value: 'between', label: 'Between dates' }
    ],
    select: [
      { value: 'equals', label: 'Equals' },
      { value: 'in', label: 'Is one of' },
      { value: 'notIn', label: 'Is not one of' }
    ],
    multiselect: [
      { value: 'in', label: 'Contains any' },
      { value: 'notIn', label: 'Does not contain' }
    ]
  }

  const getFieldType = (fieldKey: string) => {
    return fields.find(f => f.key === fieldKey)?.type || 'text'
  }

  const getFieldOptions = (fieldKey: string) => {
    return fields.find(f => f.key === fieldKey)?.options || []
  }

  const handleAddFilter = () => {
    if (!selectedField || !selectedOperator || !filterValue) {
      toast({
        title: "Incomplete Filter",
        description: "Please select a field, operator, and value.",
        variant: "error",
      })
      return
    }

    const field = fields.find(f => f.key === selectedField)
    if (!field) return

    const newFilter: SearchFilter = {
      field: selectedField,
      operator: selectedOperator as any,
      value: filterValue,
      label: `${field.label} ${operators[field.type].find(op => op.value === selectedOperator)?.label} ${filterValue}`
    }

    setFilters(prev => [...prev, newFilter])
    setSelectedField("")
    setSelectedOperator("")
    setFilterValue("")
    setDateRange({})
  }

  const handleRemoveFilter = (index: number) => {
    setFilters(prev => prev.filter((_, i) => i !== index))
  }

  const handleSearch = () => {
    if (searchTerm.trim()) {
      // Add a general search filter
      const generalFilter: SearchFilter = {
        field: 'general',
        operator: 'contains',
        value: searchTerm,
        label: `General search: "${searchTerm}"`
      }
      onSearch([generalFilter, ...filters])
    } else {
      onSearch(filters)
    }
    setIsOpen(false)
  }

  const handleClear = () => {
    setSearchTerm("")
    setFilters([])
    setSelectedField("")
    setSelectedOperator("")
    setFilterValue("")
    setDateRange({})
    onClear()
    setIsOpen(false)
  }

  const handleQuickFilter = (quickFilter: { label: string; filters: SearchFilter[] }) => {
    setFilters(quickFilter.filters)
    onSearch(quickFilter.filters)
    setIsOpen(false)
  }

  const renderFilterInput = () => {
    const fieldType = getFieldType(selectedField)
    const fieldOptions = getFieldOptions(selectedField)

    switch (fieldType) {
      case 'date':
        return (
          <div className="space-y-2">
            {selectedOperator === 'between' ? (
              <div className="flex space-x-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.from && dateRange.from instanceof Date ? format(dateRange.from, "PPP") : "From date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from instanceof Date ? dateRange.from : undefined}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange.to && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange.to && dateRange.to instanceof Date ? format(dateRange.to, "PPP") : "To date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to instanceof Date ? dateRange.to : undefined}
                      onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !filterValue && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filterValue && filterValue instanceof Date ? format(filterValue, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filterValue instanceof Date ? filterValue : undefined}
                    onSelect={setFilterValue}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        )

      case 'select':
      case 'multiselect':
        return (
          <Select value={filterValue} onValueChange={setFilterValue}>
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {fieldOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      case 'number':
        return (
          <Input
            type="number"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Enter number"
          />
        )

      default:
        return (
          <Input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Enter value"
          />
        )
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar */}
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch()
              }
            }}
          />
        </div>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="px-3">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {filters.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                  {filters.length}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Advanced Filters</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-8 px-2"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick Filters */}
              {showQuickFilters && quickFilters.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Quick Filters</Label>
                  <div className="flex flex-wrap gap-2">
                    {quickFilters.map((quickFilter, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickFilter(quickFilter)}
                        className="h-8"
                      >
                        {quickFilter.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Filters */}
              {filters.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Active Filters</Label>
                  <div className="space-y-2">
                    {filters.map((filter, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <span className="text-sm">{filter.label}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFilter(index)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Filter */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Add Filter</Label>

                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={selectedField}
                    onValueChange={(value) => {
                      setSelectedField(value)
                      setFilterValue("")
                      setSelectedOperator("")
                      setDateRange({})
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((field) => (
                        <SelectItem key={field.key} value={field.key}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedField && (
                    <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                      <SelectTrigger>
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {operators[getFieldType(selectedField)].map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {selectedField && selectedOperator && (
                    <Button onClick={handleAddFilter} size="sm">
                      Add
                    </Button>
                  )}
                </div>

                {selectedField && selectedOperator && (
                  <div className="space-y-2">
                    <Label className="text-sm">Value</Label>
                    {renderFilterInput()}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClear} size="sm">
                  Clear All
                </Button>
                <Button onClick={handleSearch} size="sm">
                  Apply Filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
