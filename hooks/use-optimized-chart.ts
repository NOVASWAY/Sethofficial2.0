import { useMemo, useCallback, useState, useEffect } from 'react'

interface ChartDataPoint {
  [key: string]: any
}

interface UseOptimizedChartOptions {
  data: ChartDataPoint[]
  enableAnimation?: boolean
  enableTooltip?: boolean
  enableLegend?: boolean
  throttleUpdates?: boolean
  throttleMs?: number
}

/**
 * Hook for optimizing chart rendering performance
 * Reduces unnecessary re-renders and improves chart performance
 */
export function useOptimizedChart<T extends ChartDataPoint>({
  data,
  enableAnimation = true,
  enableTooltip = true,
  enableLegend = true,
  throttleUpdates = true,
  throttleMs = 100,
}: UseOptimizedChartOptions) {
  const [isClient, setIsClient] = useState(false)
  const [shouldRender, setShouldRender] = useState(true)

  // Ensure client-side only rendering for charts
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Throttle chart updates
  useEffect(() => {
    if (!throttleUpdates) {
      setShouldRender(true)
      return
    }

    setShouldRender(false)
    const timer = setTimeout(() => {
      setShouldRender(true)
    }, throttleMs)

    return () => clearTimeout(timer)
  }, [data, throttleUpdates, throttleMs])

  // Memoize processed data
  const processedData = useMemo(() => {
    if (!shouldRender) return []
    
    // Process data for chart consumption
    // Remove undefined/null values that can cause rendering issues
    return data.map(item => {
      const processed: any = {}
      Object.keys(item).forEach(key => {
        const value = item[key]
        if (value !== undefined && value !== null) {
          processed[key] = value
        }
      })
      return processed
    })
  }, [data, shouldRender])

  // Memoize chart configuration
  const chartConfig = useMemo(() => ({
    animation: enableAnimation,
    animationDuration: 300,
    isAnimationActive: enableAnimation && isClient,
    // Disable animations on initial render for better performance
    isUpdateAnimationActive: enableAnimation && isClient && shouldRender,
  }), [enableAnimation, isClient, shouldRender])

  // Memoize tooltip configuration
  const tooltipConfig = useMemo(() => ({
    active: enableTooltip,
    animationDuration: 200,
    contentStyle: {
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid #ccc',
      borderRadius: '4px',
      padding: '8px',
    },
  }), [enableTooltip])

  // Memoize legend configuration
  const legendConfig = useMemo(() => ({
    enabled: enableLegend,
    wrapperStyle: {
      paddingTop: '20px',
    },
  }), [enableLegend])

  // Check if data is empty
  const isEmpty = useMemo(() => {
    return !processedData || processedData.length === 0
  }, [processedData])

  // Get data summary for debugging
  const dataSummary = useMemo(() => ({
    count: processedData.length,
    isEmpty,
    firstItem: processedData[0] || null,
    lastItem: processedData[processedData.length - 1] || null,
  }), [processedData, isEmpty])

  return {
    processedData,
    chartConfig,
    tooltipConfig,
    legendConfig,
    isEmpty,
    dataSummary,
    isClient,
    shouldRender,
  }
}

/**
 * Hook for lazy loading charts
 * Only renders charts when they're visible in the viewport
 */
export function useLazyChart(options: {
  threshold?: number
  rootMargin?: string
}) {
  const { threshold = 0.1, rootMargin = '50px' } = options
  const [isVisible, setIsVisible] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || hasRendered) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          setHasRendered(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(ref.current)

    return () => {
      observer.disconnect()
    }
  }, [threshold, rootMargin, hasRendered])

  return { ref, isVisible }
}

/**
 * Optimized chart wrapper component props
 */
export interface OptimizedChartProps {
  data: any[]
  height?: number
  width?: number
  animate?: boolean
  throttleMs?: number
  children: React.ReactNode
}

/**
 * Memoized chart data processor
 */
export function useChartDataProcessor<T extends ChartDataPoint>({
  data,
  transform,
  filter,
  sort,
}: {
  data: T[]
  transform?: (item: T) => any
  filter?: (item: T) => boolean
  sort?: (a: T, b: T) => number
}) {
  return useMemo(() => {
    let processed = [...data]

    if (filter) {
      processed = processed.filter(filter)
    }

    if (sort) {
      processed = processed.sort(sort)
    }

    if (transform) {
      processed = processed.map(transform)
    }

    return processed
  }, [data, transform, filter, sort])
}

/**
 * Hook for debouncing chart data updates
 */
export function useDebouncedChartData<T>(
  data: T[],
  delay: number = 300
) {
  const [debouncedData, setDebouncedData] = useState(data)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedData(data)
    }, delay)

    return () => clearTimeout(timer)
  }, [data, delay])

  return debouncedData
}

