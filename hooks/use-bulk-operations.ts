import { useState, useCallback, useMemo } from 'react'

interface UseBulkOperationsOptions<T> {
  items: T[]
  getItemId: (item: T) => string
  onBulkDelete?: (ids: string[]) => Promise<void>
  onBulkUpdate?: (ids: string[], updates: Partial<T>) => Promise<void>
  onBulkExport?: (items: T[]) => void
}

/**
 * Hook for managing bulk operations (select, delete, update, export)
 * Improves efficiency for managing multiple items at once
 */
export function useBulkOperations<T>({
  items,
  getItemId,
  onBulkDelete,
  onBulkUpdate,
  onBulkExport,
}: UseBulkOperationsOptions<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isProcessing, setIsProcessing] = useState(false)

  // Get selected items
  const selectedItems = useMemo(() => {
    return items.filter(item => selectedIds.has(getItemId(item)))
  }, [items, selectedIds, getItemId])

  // Check if item is selected
  const isSelected = useCallback((item: T) => {
    return selectedIds.has(getItemId(item))
  }, [selectedIds, getItemId])

  // Toggle selection of a single item
  const toggleSelection = useCallback((item: T) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      const id = getItemId(item)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }, [getItemId])

  // Select all items
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map(item => getItemId(item))))
  }, [items, getItemId])

  // Deselect all items
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Toggle select all
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      deselectAll()
    } else {
      selectAll()
    }
  }, [selectedIds.size, items.length, selectAll, deselectAll])

  // Check if all items are selected
  const isAllSelected = useMemo(() => {
    return items.length > 0 && selectedIds.size === items.length
  }, [items.length, selectedIds.size])

  // Check if some items are selected
  const isSomeSelected = useMemo(() => {
    return selectedIds.size > 0 && selectedIds.size < items.length
  }, [selectedIds.size, items.length])

  // Bulk delete
  const handleBulkDelete = useCallback(async () => {
    if (!onBulkDelete || selectedIds.size === 0) return

    try {
      setIsProcessing(true)
      await onBulkDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Bulk delete failed:', error)
      throw error
    } finally {
      setIsProcessing(false)
    }
  }, [onBulkDelete, selectedIds])

  // Bulk update
  const handleBulkUpdate = useCallback(async (updates: Partial<T>) => {
    if (!onBulkUpdate || selectedIds.size === 0) return

    try {
      setIsProcessing(true)
      await onBulkUpdate(Array.from(selectedIds), updates)
      setSelectedIds(new Set())
    } catch (error) {
      console.error('Bulk update failed:', error)
      throw error
    } finally {
      setIsProcessing(false)
    }
  }, [onBulkUpdate, selectedIds])

  // Bulk export
  const handleBulkExport = useCallback(() => {
    if (!onBulkExport || selectedItems.length === 0) return
    onBulkExport(selectedItems)
    setSelectedIds(new Set())
  }, [onBulkExport, selectedItems])

  // Get selected count
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds.size])

  return {
    selectedIds: Array.from(selectedIds),
    selectedItems,
    selectedCount,
    isSelected,
    isAllSelected,
    isSomeSelected,
    isProcessing,
    toggleSelection,
    selectAll,
    deselectAll,
    toggleSelectAll,
    handleBulkDelete,
    handleBulkUpdate,
    handleBulkExport,
    clearSelection: deselectAll,
  }
}

