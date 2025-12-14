"use client"

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/service-worker'

/**
 * Component to register service worker on client-side
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // Unregister service workers to resolve "white screen" / hard refresh issues
    // caused by stale caching in development/rapid iteration.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister()
        }
      })
    }
  }, [])

  return null
}

