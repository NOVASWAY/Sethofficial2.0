interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private windowMs: number
  private maxRequests: number

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
  }

  check(key: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now()
    const entry = this.store.get(key)

    if (!entry || now > entry.resetAt) {
      const resetAt = now + this.windowMs
      this.store.set(key, { count: 1, resetAt })
      return { allowed: true, remaining: this.maxRequests - 1, resetAt }
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt }
    }

    entry.count++
    return { allowed: true, remaining: this.maxRequests - entry.count, resetAt: entry.resetAt }
  }

  reset(key: string): void {
    this.store.delete(key)
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key)
      }
    }
  }
}

export const apiLimiter = new RateLimiter(60 * 1000, 100)
export const authLimiter = new RateLimiter(15 * 60 * 1000, 10)
export const mfaLimiter = new RateLimiter(15 * 60 * 1000, 5)

// NOTE (pilot stopgap): these limiters are in-memory per serverless instance.
// They blunt casual brute force but do not replace Redis-backed throttle + lockout.
export function clientIpFromHeaders(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headers.get("x-real-ip")
    || "unknown"
}

export function throttle(
  headers: Headers,
  limiter: RateLimiter,
  scope: string
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const key = `${scope}:${clientIpFromHeaders(headers)}`
  const { allowed, resetAt } = limiter.check(key)
  if (allowed) return { allowed: true }
  return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)) }
}

export function rateLimitResponse(remaining: number, resetAt: number): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  }
}
