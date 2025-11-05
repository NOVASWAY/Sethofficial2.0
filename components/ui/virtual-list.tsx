"use client"

import React, { useMemo, useRef, useEffect, useState, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number | ((index: number) => number)
  renderItem: (item: T, index: number, style: CSSProperties) => React.ReactNode
  containerHeight: number
  overscan?: number
  className?: string
  onScroll?: (scrollTop: number) => void
  estimatedItemHeight?: number
}

/**
 * Virtual scrolling list component
 * Only renders visible items to improve performance with large datasets (1000+ items)
 */
export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  containerHeight,
  overscan = 5,
  className,
  onScroll,
  estimatedItemHeight = 50,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  // Calculate total height
  const totalHeight = useMemo(() => {
    if (typeof itemHeight === 'number') {
      return items.length * itemHeight
    }
    // Estimate total height if dynamic
    return items.length * estimatedItemHeight
  }, [items.length, itemHeight, estimatedItemHeight])

  // Calculate visible range
  const { startIndex, endIndex, visibleItems } = useMemo(() => {
    let start = 0
    let end = items.length
    let currentTop = 0

    // Find start index
    if (typeof itemHeight === 'number') {
      start = Math.floor(scrollTop / itemHeight)
    } else {
      // Dynamic height - estimate
      for (let i = 0; i < items.length; i++) {
        const height = itemHeight(i)
        if (currentTop + height > scrollTop) {
          start = i
          break
        }
        currentTop += height
      }
    }

    // Find end index
    const visibleHeight = containerHeight
    if (typeof itemHeight === 'number') {
      end = Math.min(
        items.length,
        Math.ceil((scrollTop + visibleHeight) / itemHeight)
      )
    } else {
      // Dynamic height - estimate
      let currentBottom = currentTop
      for (let i = start; i < items.length; i++) {
        const height = itemHeight(i)
        if (currentBottom > scrollTop + visibleHeight) {
          end = i
          break
        }
        currentBottom += height
      }
    }

    // Add overscan
    start = Math.max(0, start - overscan)
    end = Math.min(items.length, end + overscan)

    // Get visible items with their offsets
    const visible: Array<{ item: T; index: number; offset: number }> = []
    let offset = 0

    if (typeof itemHeight === 'number') {
      offset = start * itemHeight
      for (let i = start; i < end; i++) {
        visible.push({
          item: items[i],
          index: i,
          offset: offset,
        })
        offset += itemHeight
      }
    } else {
      // Dynamic height - calculate offsets
      for (let i = 0; i < start; i++) {
        offset += itemHeight(i)
      }
      for (let i = start; i < end; i++) {
        visible.push({
          item: items[i],
          index: i,
          offset: offset,
        })
        offset += itemHeight(i)
      }
    }

    return { startIndex: start, endIndex: end, visibleItems: visible }
  }, [items, scrollTop, containerHeight, itemHeight, overscan])

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    onScroll?.(newScrollTop)
  }

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, offset }) => {
          const height = typeof itemHeight === 'number' ? itemHeight : itemHeight(index)
          const style: CSSProperties = {
            position: 'absolute',
            top: offset,
            left: 0,
            right: 0,
            height: height,
          }

          return (
            <div key={index} style={style}>
              {renderItem(item, index, style)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Hook for virtual scrolling calculations
 */
export function useVirtualScroll<T>({
  items,
  containerHeight,
  itemHeight,
  overscan = 5,
}: {
  items: T[]
  containerHeight: number
  itemHeight: number | ((index: number) => number)
  overscan?: number
}) {
  const [scrollTop, setScrollTop] = useState(0)

  const { startIndex, endIndex, visibleItems, totalHeight } = useMemo(() => {
    let start = 0
    let end = items.length
    let currentTop = 0

    // Find start index
    if (typeof itemHeight === 'number') {
      start = Math.floor(scrollTop / itemHeight)
    } else {
      for (let i = 0; i < items.length; i++) {
        const height = itemHeight(i)
        if (currentTop + height > scrollTop) {
          start = i
          break
        }
        currentTop += height
      }
    }

    // Find end index
    if (typeof itemHeight === 'number') {
      end = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight)
      )
    } else {
      let currentBottom = currentTop
      for (let i = start; i < items.length; i++) {
        const height = itemHeight(i)
        if (currentBottom > scrollTop + containerHeight) {
          end = i
          break
        }
        currentBottom += height
      }
    }

    // Add overscan
    start = Math.max(0, start - overscan)
    end = Math.min(items.length, end + overscan)

    // Calculate total height
    let total = 0
    if (typeof itemHeight === 'number') {
      total = items.length * itemHeight
    } else {
      for (let i = 0; i < items.length; i++) {
        total += itemHeight(i)
      }
    }

    // Get visible items
    const visible: Array<{ item: T; index: number; offset: number }> = []
    let offset = 0

    if (typeof itemHeight === 'number') {
      offset = start * itemHeight
      for (let i = start; i < end; i++) {
        visible.push({
          item: items[i],
          index: i,
          offset: offset,
        })
        offset += itemHeight
      }
    } else {
      for (let i = 0; i < start; i++) {
        offset += itemHeight(i)
      }
      for (let i = start; i < end; i++) {
        visible.push({
          item: items[i],
          index: i,
          offset: offset,
        })
        offset += itemHeight(i)
      }
    }

    return { startIndex: start, endIndex: end, visibleItems: visible, totalHeight: total }
  }, [items, scrollTop, containerHeight, itemHeight, overscan])

  return {
    scrollTop,
    setScrollTop,
    startIndex,
    endIndex,
    visibleItems,
    totalHeight,
  }
}

