"use client"

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/service-worker'

/**
 * Component to register service worker on client-side
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    registerServiceWorker().catch((error) => {
      console.warn('Service Worker registration failed:', error)
    })
  }, [])

  return null
}

