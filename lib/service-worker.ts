/**
 * Service Worker registration and management utilities
 */

const SW_PATH = '/sw.js'
const SW_REGISTRATION_TIMEOUT = 5000

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported')
    return null
  }

  try {
    const registration = await Promise.race([
      navigator.serviceWorker.register(SW_PATH),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Registration timeout')), SW_REGISTRATION_TIMEOUT)
      ),
    ]) as ServiceWorkerRegistration

    console.log('Service Worker registered:', registration)

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            console.log('New service worker available')
            // Could show a notification to the user here
          }
        })
      }
    })

    return registration
  } catch (error) {
    console.error('Service Worker registration failed:', error)
    return null
  }
}

/**
 * Unregister service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const result = await registration.unregister()
    console.log('Service Worker unregistered:', result)
    return result
  } catch (error) {
    console.error('Service Worker unregistration failed:', error)
    return false
  }
}

/**
 * Clear API cache
 */
export async function clearAPICache(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    return new Promise((resolve) => {
      const channel = new MessageChannel()
      channel.port1.onmessage = (event) => {
        resolve(event.data.success === true)
      }
      registration.active?.postMessage({ type: 'CLEAR_CACHE' }, [channel.port2])
    })
  } catch (error) {
    console.error('Failed to clear API cache:', error)
    return false
  }
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    return new Promise((resolve) => {
      const channel = new MessageChannel()
      channel.port1.onmessage = (event) => {
        resolve(event.data.success === true)
      }
      registration.active?.postMessage({ type: 'CLEAR_ALL_CACHES' }, [channel.port2])
    })
  } catch (error) {
    console.error('Failed to clear all caches:', error)
    return false
  }
}

/**
 * Check if service worker is supported
 */
export function isServiceWorkerSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator
}

/**
 * Get service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null
  }

  try {
    return await navigator.serviceWorker.ready
  } catch (error) {
    console.error('Failed to get service worker registration:', error)
    return null
  }
}

/**
 * Hook for React components to use service worker
 */
import { useEffect, useState } from 'react'

export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    setIsSupported(isServiceWorkerSupported())

    if (isServiceWorkerSupported()) {
      registerServiceWorker().then(setRegistration)
    }
  }, [])

  const clearCache = async () => {
    return await clearAPICache()
  }

  const clearAll = async () => {
    return await clearAllCaches()
  }

  return {
    registration,
    isSupported,
    clearCache,
    clearAll,
  }
}

