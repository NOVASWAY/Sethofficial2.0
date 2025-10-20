'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { searchDiagnoses, type Diagnosis } from '@/lib/icd11-diagnoses'
import { Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DiagnosisAutocompleteProps {
  value?: string
  onChange: (diagnosis: Diagnosis | null) => void
  placeholder?: string
  label?: string
  required?: boolean
}

export function DiagnosisAutocomplete({
  value = '',
  onChange,
  placeholder = 'Type diagnosis (e.g., malaria, fever, diabetes)...',
  label = 'Diagnosis',
  required = false
}: DiagnosisAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<Diagnosis[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<Diagnosis | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Search diagnoses when input changes
  useEffect(() => {
    if (inputValue.length >= 2) {
      const results = searchDiagnoses(inputValue, 8)
      setSuggestions(results)
      setShowSuggestions(true)
      setSelectedIndex(-1)
    } else if (inputValue.length === 0) {
      // Show common diagnoses when empty
      const common = searchDiagnoses('', 8)
      setSuggestions(common)
      setSelectedIndex(-1)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [inputValue])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setSelectedDiagnosis(null)
    onChange(null)
  }

  // Handle diagnosis selection
  const handleSelect = (diagnosis: Diagnosis) => {
    setSelectedDiagnosis(diagnosis)
    setInputValue(diagnosis.name)
    setShowSuggestions(false)
    onChange(diagnosis)
  }

  // Handle clearing selection
  const handleClear = () => {
    setSelectedDiagnosis(null)
    setInputValue('')
    setShowSuggestions(false)
    onChange(null)
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        break
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.length >= 2 || inputValue.length === 0) {
                setShowSuggestions(true)
              }
            }}
            placeholder={placeholder}
            required={required}
            className={cn(
              "pl-10",
              selectedDiagnosis && "border-green-500 bg-green-50"
            )}
          />
          {selectedDiagnosis && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Selected diagnosis display */}
        {selectedDiagnosis && (
          <div className="mt-2 flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
            <Check className="h-4 w-4 text-green-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">
                {selectedDiagnosis.name}
              </p>
              <p className="text-xs text-green-700">
                ICD-11: {selectedDiagnosis.code} • {selectedDiagnosis.category}
              </p>
            </div>
          </div>
        )}

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && !selectedDiagnosis && (
          <Card
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 max-h-80 overflow-y-auto shadow-lg"
          >
            <div className="p-2 space-y-1">
              {inputValue.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground border-b">
                  Common Diagnoses (type to search)
                </div>
              )}
              {suggestions.map((diagnosis, index) => (
                <button
                  key={diagnosis.code}
                  type="button"
                  onClick={() => handleSelect(diagnosis)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-md transition-colors",
                    "hover:bg-accent focus:bg-accent focus:outline-none",
                    selectedIndex === index && "bg-accent"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {diagnosis.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {diagnosis.code}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {diagnosis.category}
                        </span>
                      </div>
                    </div>
                    {diagnosis.common && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        Common
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* No results message */}
        {showSuggestions && suggestions.length === 0 && inputValue.length >= 2 && (
          <Card className="absolute z-50 w-full mt-1 shadow-lg">
            <div className="p-4 text-center text-sm text-muted-foreground">
              No diagnoses found for "{inputValue}"
              <p className="text-xs mt-1">Try different keywords (e.g., fever, malaria, diabetes)</p>
            </div>
          </Card>
        )}
      </div>

      {/* Helper text */}
      {!selectedDiagnosis && (
        <p className="text-xs text-muted-foreground">
          💡 Tip: Type symptoms or condition name (e.g., "fever", "malaria", "chest pain")
        </p>
      )}
    </div>
  )
}

// Multiple diagnoses selector
interface MultipleDiagnosesProps {
  value: Diagnosis[]
  onChange: (diagnoses: Diagnosis[]) => void
  maxDiagnoses?: number
  label?: string
}

export function MultipleDiagnoses({
  value = [],
  onChange,
  maxDiagnoses = 5,
  label = 'Diagnoses'
}: MultipleDiagnosesProps) {
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<Diagnosis[]>(value)

  const handleAdd = (diagnosis: Diagnosis | null) => {
    if (!diagnosis) return
    
    // Check if already added
    if (selectedDiagnoses.some(d => d.code === diagnosis.code)) {
      return
    }

    // Check max limit
    if (selectedDiagnoses.length >= maxDiagnoses) {
      return
    }

    const updated = [...selectedDiagnoses, diagnosis]
    setSelectedDiagnoses(updated)
    onChange(updated)
  }

  const handleRemove = (code: string) => {
    const updated = selectedDiagnoses.filter(d => d.code !== code)
    setSelectedDiagnoses(updated)
    onChange(updated)
  }

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      
      {/* Selected diagnoses */}
      {selectedDiagnoses.length > 0 && (
        <div className="space-y-2">
          {selectedDiagnoses.map((diagnosis, index) => (
            <div
              key={diagnosis.code}
              className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md"
            >
              <Badge variant="outline" className="font-mono">
                {index + 1}
              </Badge>
              <div className="flex-1">
                <p className="text-sm font-medium">{diagnosis.name}</p>
                <p className="text-xs text-muted-foreground">
                  {diagnosis.code} • {diagnosis.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(diagnosis.code)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add more */}
      {selectedDiagnoses.length < maxDiagnoses && (
        <DiagnosisAutocomplete
          onChange={handleAdd}
          placeholder={`Add diagnosis ${selectedDiagnoses.length + 1}/${maxDiagnoses}...`}
          label=""
        />
      )}

      {selectedDiagnoses.length >= maxDiagnoses && (
        <p className="text-xs text-muted-foreground">
          Maximum {maxDiagnoses} diagnoses reached
        </p>
      )}
    </div>
  )
}

