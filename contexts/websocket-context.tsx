"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { wsClient, WebSocketClient } from '@/lib/api'

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

  const connect = async () => {
    try {
      await wsClient.connect()
      setIsConnected(true)
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
      setIsConnected(false)
    }
  }

  const disconnect = () => {
    wsClient.disconnect()
    setIsConnected(false)
  }

  const send = (message: any) => {
    wsClient.send(message)
  }

  const on = (event: string, callback: Function) => {
    wsClient.on(event, callback)
  }

  const off = (event: string, callback: Function) => {
    wsClient.off(event, callback)
  }

  // Auto-connect on mount
  useEffect(() => {
    connect()

    // Cleanup on unmount
    return () => {
      disconnect()
    }
  }, [])

  const value: WebSocketContextType = {
    isConnected,
    connect,
    disconnect,
    send,
    on,
    off,
  }

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
