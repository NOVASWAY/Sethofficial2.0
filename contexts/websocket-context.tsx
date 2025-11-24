"use client"

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react'

// Lazy import to avoid module initialization issues
let wsClientModule: any = null
const getWsClient = async () => {
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return null
  }
  
  if (!wsClientModule) {
    try {
      // Use dynamic import to avoid module initialization during SSR
      const apiModule = await import('@/lib/api')
      // Use the factory function
      wsClientModule = apiModule.getWsClient()
    } catch (error) {
      console.error('Failed to load WebSocket client:', error)
      return null
    }
  }
  return wsClientModule
}

interface WebSocketContextType {
  isConnected: boolean
  connect: () => Promise<void>
  disconnect: () => void
  send: (message: any) => void
  on: (event: string, callback: Function) => void
  off: (event: string, callback: Function) => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false)

  const connect = useCallback(async () => {
    try {
      // Only attempt connection if WebSocket is available (browser environment)
      if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
        return
      }
      const client = await getWsClient()
      if (client) {
        await client.connect()
        setIsConnected(true)
      }
    } catch (error) {
      // Silently handle connection errors - don't crash the app
      console.error('Failed to connect to WebSocket:', error)
      setIsConnected(false)
    }
  }, [])

  const disconnect = useCallback(async () => {
    try {
      const client = await getWsClient()
      if (client) {
        try {
          client.disconnect()
        } catch (error) {
          console.error('WebSocket disconnect error:', error)
        }
      }
    } catch (error) {
      console.error('Error getting WebSocket client for disconnect:', error)
    }
    setIsConnected(false)
  }, [])

  const send = useCallback(async (message: any) => {
    try {
      const client = await getWsClient()
      if (client) {
        try {
          client.send(message)
        } catch (error) {
          console.error('WebSocket send error:', error)
        }
      }
    } catch (error) {
      console.error('Error getting WebSocket client for send:', error)
    }
  }, [])

  const on = useCallback(async (event: string, callback: Function) => {
    try {
      const client = await getWsClient()
      if (client) {
        try {
          client.on(event, callback)
        } catch (error) {
          console.error('WebSocket on error:', error)
        }
      }
    } catch (error) {
      console.error('Error getting WebSocket client for on:', error)
    }
  }, [])

  const off = useCallback(async (event: string, callback: Function) => {
    try {
      const client = await getWsClient()
      if (client) {
        try {
          client.off(event, callback)
        } catch (error) {
          console.error('WebSocket off error:', error)
        }
      }
    } catch (error) {
      console.error('Error getting WebSocket client for off:', error)
    }
  }, [])

  // Auto-connect on mount - with error handling
  useEffect(() => {
    // Wrap in try-catch to prevent crashes
    const attemptConnect = async () => {
      try {
        await connect()
      } catch (error) {
        // Silently handle connection errors - don't crash the app
        console.error('WebSocket connection failed:', error)
      }
    }
    
    // Only attempt connection in browser
    if (typeof window !== 'undefined') {
      attemptConnect()
    }

    // Cleanup on unmount
    return () => {
      try {
        disconnect()
      } catch (error) {
        console.error('WebSocket disconnect error:', error)
      }
    }
  }, [connect, disconnect])

  const value: WebSocketContextType = useMemo(() => ({
    isConnected,
    connect,
    disconnect,
    send,
    on,
    off,
  }), [isConnected, connect, disconnect, send, on, off])

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}
