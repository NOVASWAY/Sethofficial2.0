/**
 * Service Worker for persistent caching
 * Caches static assets and API responses across sessions
 */

const CACHE_VERSION = 'v1.0.0'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const API_CACHE = `api-${CACHE_VERSION}`

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/favicon.ico',
]

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/dashboard/,
  /\/api\/patients/,
  /\/api\/appointments/,
  /\/api\/invoices/,
  /\/api\/medicines/,
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((error) => {
        console.warn('Service Worker: Failed to cache some static assets', error)
      })
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return (
              name.startsWith('static-') && name !== STATIC_CACHE ||
              name.startsWith('api-') && name !== API_CACHE
            )
          })
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request))
    return
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request))
})

/**
 * Handle API requests with caching strategy
 */
async function handleAPIRequest(request) {
  const url = new URL(request.url)

  // Check if this endpoint should be cached
  const shouldCache = API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname))

  if (!shouldCache) {
    // Network-first for non-cacheable endpoints
    return fetch(request).catch(() => {
      return new Response(JSON.stringify({ error: 'Network unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    })
  }

  // Cache-first strategy for cacheable endpoints
  try {
    const cache = await caches.open(API_CACHE)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      // Return cached response
      return cachedResponse
    }

    // Fetch from network
    const networkResponse = await fetch(request)

    // Cache successful responses
    if (networkResponse.ok) {
      // Clone response before caching (responses can only be read once)
      const responseToCache = networkResponse.clone()
      cache.put(request, responseToCache)

      // Set expiration header (5 minutes)
      const headers = new Headers(networkResponse.headers)
      headers.set('X-Cached-At', Date.now().toString())
      headers.set('X-Cache-TTL', (5 * 60 * 1000).toString())

      return new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: headers,
      })
    }

    return networkResponse
  } catch (error) {
    console.error('Service Worker: API fetch failed', error)
    return new Response(JSON.stringify({ error: 'Network error' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Handle static asset requests with cache-first strategy
 */
async function handleStaticRequest(request) {
  try {
    const cache = await caches.open(STATIC_CACHE)
    const cachedResponse = await cache.match(request)

    if (cachedResponse) {
      return cachedResponse
    }

    // Fetch from network
    const networkResponse = await fetch(request)

    // Cache successful responses
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone()
      cache.put(request, responseToCache)
    }

    return networkResponse
  } catch (error) {
    console.error('Service Worker: Static fetch failed', error)
    throw error
  }
}

/**
 * Message handler for cache invalidation
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(API_CACHE).then(() => {
      event.ports[0].postMessage({ success: true })
    })
  }

  if (event.data && event.data.type === 'CLEAR_ALL_CACHES') {
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((name) => caches.delete(name)))
    }).then(() => {
      event.ports[0].postMessage({ success: true })
    })
  }
})

