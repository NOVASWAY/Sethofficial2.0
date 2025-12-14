"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Edit, Download, MoreVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BulkActionsProps {
  selectedCount: number
  isAllSelected: boolean
  isSomeSelected: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onBulkDelete?: () => void
  onBulkUpdate?: () => void
  onBulkExport?: () => void
  className?: string
}

/**
 * Bulk actions toolbar component
 * Displays selection controls and bulk operation buttons
 */
export function BulkActions({
  selectedCount,
  isAllSelected,
  isSomeSelected,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkUpdate,
  onBulkExport,
  className,
}: BulkActionsProps) {
  if (selectedCount === 0) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={isAllSelected ? onDeselectAll : onSelectAll}
          aria-label="Select all"
        />
        <span className="text-sm text-muted-foreground">
          {isAllSelected ? 'Deselect all' : 'Select all'}
        </span>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center justify-between p-3 bg-muted/50 rounded-lg", className)}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={isAllSelected ? onDeselectAll : onSelectAll}
            aria-label={isAllSelected ? 'Deselect all' : 'Select all'}
          />
          <span className="text-sm font-medium">
            {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeselectAll}
          className="h-8"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {onBulkExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkExport}
            className="h-8"
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        )}

        {onBulkUpdate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkUpdate}
            className="h-8"
          >
            <Edit className="h-4 w-4 mr-1" />
            Update
          </Button>
        )}

        {onBulkDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            className="h-8"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        )}

        {(onBulkDelete || onBulkUpdate || onBulkExport) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onBulkExport && (
                <DropdownMenuItem onClick={onBulkExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </DropdownMenuItem>
              )}
              {onBulkUpdate && (
                <DropdownMenuItem onClick={onBulkUpdate}>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Selected
                </DropdownMenuItem>
              )}
              {onBulkDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onBulkDelete}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

/**
 * Bulk selection checkbox component
 */
interface BulkSelectionCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  ariaLabel?: string
  className?: string
}

export function BulkSelectionCheckbox({
  checked,
  onCheckedChange,
  ariaLabel,
  className,
}: BulkSelectionCheckboxProps) {
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel || 'Select item'}
      className={className}
    />
  )
}

