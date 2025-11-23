"use client"

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, ReactNode } from 'react'

// Lazy import to avoid module initialization issues
let wsClient: any = null
const getWsClient = async () => {
  if (!wsClient && typeof window !== 'undefined') {
    try {
      const apiModule = await import('@/lib/api')
      wsClient = apiModule.wsClient
    } catch (error) {
      console.error('Failed to load WebSocket client:', error)
    }
  }
  return wsClient
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

  const disconnect = useCallback(() => {
    if (wsClient) {
      try {
        wsClient.disconnect()
      } catch (error) {
        console.error('WebSocket disconnect error:', error)
      }
    }
    setIsConnected(false)
  }, [])

  const send = useCallback((message: any) => {
    if (wsClient) {
      try {
        wsClient.send(message)
      } catch (error) {
        console.error('WebSocket send error:', error)
      }
    }
  }, [])

  const on = useCallback((event: string, callback: Function) => {
    if (wsClient) {
      try {
        wsClient.on(event, callback)
      } catch (error) {
        console.error('WebSocket on error:', error)
      }
    }
  }, [])

  const off = useCallback((event: string, callback: Function) => {
    if (wsClient) {
      try {
        wsClient.off(event, callback)
      } catch (error) {
        console.error('WebSocket off error:', error)
      }
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
