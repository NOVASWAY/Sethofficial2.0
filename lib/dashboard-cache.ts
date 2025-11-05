/**
 * Dashboard Data Caching Utility
 * Implements in-memory caching for dashboard API responses to reduce redundant API calls
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

class DashboardCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes default

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache entry with optional TTL
   */
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    })
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())
    const valid = entries.filter(([_, entry]) => now <= entry.expiresAt)
    const expired = entries.filter(([_, entry]) => now > entry.expiresAt)

    return {
      total: entries.length,
      valid: valid.length,
      expired: expired.length,
      size: this.cache.size
    }
  }
}

// Singleton instance
export const dashboardCache = new DashboardCache()

/**
 * Generate cache key for dashboard metrics
 */
export function getCacheKey(type: string, params?: Record<string, any>): string {
  const paramString = params ? JSON.stringify(params) : ''
  return `dashboard:${type}:${paramString}`
}

/**
 * Cache wrapper for async functions
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache first
  const cached = dashboardCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  const data = await fetcher()
  
  // Cache the result
  dashboardCache.set(key, data, ttl)
  
  return data
}

