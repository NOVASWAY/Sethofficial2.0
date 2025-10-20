"use client"

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/auth-context'

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: string
}

export interface WebSocketState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastMessage: WebSocketMessage | null
}

export interface UseWebSocketOptions {
  url?: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8081/ws',
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
    onMessage,
    onConnect,
    onDisconnect,
    onError
  } = options

  const { user, isAuthenticated } = useAuth()
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastMessage: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const shouldReconnectRef = useRef(true)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    if (!isAuthenticated || !user) {
      return
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Add authentication token to WebSocket URL
      const wsUrl = `${url}?token=${localStorage.getItem('auth_token')}`
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('WebSocket connected')
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null
        }))
        reconnectAttemptsRef.current = 0
        onConnect?.()
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setState(prev => ({ ...prev, lastMessage: message }))
          onMessage?.(message)
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason)
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }))
        onDisconnect?.()

        // Attempt to reconnect if not a manual close
        if (shouldReconnectRef.current && event.code !== 1000) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++
            console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect()
            }, reconnectInterval)
          } else {
            setState(prev => ({
              ...prev,
              error: 'Max reconnection attempts reached'
            }))
          }
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection error',
          isConnecting: false
        }))
        onError?.(error)
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to create WebSocket connection',
        isConnecting: false
      }))
    }
  }, [url, isAuthenticated, user, reconnectInterval, maxReconnectAttempts, onConnect, onDisconnect, onError, onMessage])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false
    }))
  }, [])

  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageWithTimestamp: WebSocketMessage = {
        ...message,
        timestamp: new Date().toISOString()
      }
      wsRef.current.send(JSON.stringify(messageWithTimestamp))
      return true
    }
    return false
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    shouldReconnectRef.current = true
    reconnectAttemptsRef.current = 0
    connect()
  }, [disconnect, connect])

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [isAuthenticated, user, connect, disconnect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    ...state,
    connect,
    disconnect,
    reconnect,
    sendMessage
  }
}

// Specialized hooks for different message types
export function useAppointmentUpdates() {
  const { lastMessage, sendMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'appointment_update') {
        console.log('Appointment update received:', message.data)
      }
    }
  })

  const sendAppointmentUpdate = useCallback((appointmentId: string, status: string) => {
    return sendMessage({
      type: 'appointment_update',
      data: { appointmentId, status }
    })
  }, [sendMessage])

  return {
    lastAppointmentUpdate: lastMessage?.type === 'appointment_update' ? lastMessage : null,
    sendAppointmentUpdate
  }
}

export function useInventoryUpdates() {
  const { lastMessage, sendMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'inventory_update') {
        console.log('Inventory update received:', message.data)
      }
    }
  })

  const sendInventoryUpdate = useCallback((medicationId: string, quantity: number) => {
    return sendMessage({
      type: 'inventory_update',
      data: { medicationId, quantity }
    })
  }, [sendMessage])

  return {
    lastInventoryUpdate: lastMessage?.type === 'inventory_update' ? lastMessage : null,
    sendInventoryUpdate
  }
}

export function usePaymentUpdates() {
  const { lastMessage, sendMessage } = useWebSocket({
    onMessage: (message) => {
      if (message.type === 'payment_update') {
        console.log('Payment update received:', message.data)
      }
    }
  })

  const sendPaymentUpdate = useCallback((invoiceId: string, status: string) => {
    return sendMessage({
      type: 'payment_update',
      data: { invoiceId, status }
    })
  }, [sendMessage])

  return {
    lastPaymentUpdate: lastMessage?.type === 'payment_update' ? lastMessage : null,
    sendPaymentUpdate
  }
}
