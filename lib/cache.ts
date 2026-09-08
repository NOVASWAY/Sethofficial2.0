interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class APICache {
  private store = new Map<string, CacheEntry<any>>()
  private defaultTTL = 60 * 1000 // 1 minute

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs || this.defaultTTL
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    })
  }

  invalidate(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key)
      }
    }
  }

  clear(): void {
    this.store.clear()
  }

  size(): number {
    return this.store.size
  }
}

export const apiCache = new APICache()

export function cachedResponse<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number
): Promise<T> {
  const cached = apiCache.get<T>(key)
  if (cached !== null) return Promise.resolve(cached)

  return fetcher().then((data) => {
    apiCache.set(key, data, ttlMs)
    return data
  })
}

export const CACHE_TTL = {
  SHORT: 30 * 1000,
  MEDIUM: 60 * 1000,
  LONG: 5 * 60 * 1000,
  VERY_LONG: 15 * 60 * 1000,
} as const
