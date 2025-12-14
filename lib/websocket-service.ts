// WebSocket service for real-time dashboard updates
// This service handles WebSocket connections and real-time data updates

import React from 'react'
import { useAuth } from '@/contexts/auth-context'

export interface WebSocketMessage {
  type: string
  data: any
  timestamp: number
  userId?: string
  role?: string
  department?: string
}

export interface WebSocketEventHandlers {
  onConnect?: () => void
  onDisconnect?: () => void
  onError?: (error: Event) => void
  onMessage?: (message: WebSocketMessage) => void
  onDashboardUpdate?: (data: any) => void
  onPatientUpdate?: (data: any) => void
  onConsultationUpdate?: (data: any) => void
  onPrescriptionUpdate?: (data: any) => void
  onInvoiceUpdate?: (data: any) => void
  onSystemAlert?: (data: any) => void
  onActivityLog?: (data: any) => void
}

export interface WebSocketConfig {
  url: string
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
  enableHeartbeat?: boolean
}

class WebSocketService {
  private ws: WebSocket | null = null
  private config: WebSocketConfig
  private handlers: WebSocketEventHandlers = {}
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private isConnecting = false
  private isConnected = false
  private authToken: string | null = null

  constructor(config: WebSocketConfig) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      enableHeartbeat: true,
      ...config
    }
  }

  // Set authentication token
  setAuthToken(token: string | null) {
    this.authToken = token
  }

  // Set event handlers
  setHandlers(handlers: WebSocketEventHandlers) {
    this.handlers = { ...this.handlers, ...handlers }
  }

  // Connect to WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || this.isConnected) {
        resolve()
        return
      }

      this.isConnecting = true

      try {
        // Build WebSocket URL with auth token
        const url = this.authToken
          ? `${this.config.url}?token=${this.authToken}`
          : this.config.url

        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.isConnected = true
          this.isConnecting = false
          this.reconnectAttempts = 0

          this.handlers.onConnect?.()

          // Start heartbeat if enabled
          if (this.config.enableHeartbeat) {
            this.startHeartbeat()
          }

          resolve()
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason)
          this.isConnected = false
          this.isConnecting = false

          this.handlers.onDisconnect?.()

          // Stop heartbeat
          this.stopHeartbeat()

          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
            this.scheduleReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnecting = false

          this.handlers.onError?.(error)
          reject(error)
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }

      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  // Disconnect from WebSocket
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.isConnected = false
    this.isConnecting = false

    // Clear timers
    this.stopHeartbeat()
    this.clearReconnectTimer()
  }

  // Send message through WebSocket
  send(message: Partial<WebSocketMessage>): boolean {
    if (!this.isConnected || !this.ws) {
      console.warn('WebSocket not connected, cannot send message')
      return false
    }

    try {
      const fullMessage: WebSocketMessage = {
        type: message.type || 'unknown',
        data: message.data || {},
        timestamp: Date.now(),
        ...message
      }

      this.ws.send(JSON.stringify(fullMessage))
      return true
    } catch (error) {
      console.error('Failed to send WebSocket message:', error)
      return false
    }
  }

  // Subscribe to specific event types
  subscribe(eventTypes: string[]): boolean {
    return this.send({
      type: 'subscribe',
      data: { eventTypes }
    })
  }

  // Unsubscribe from specific event types
  unsubscribe(eventTypes: string[]): boolean {
    return this.send({
      type: 'unsubscribe',
      data: { eventTypes }
    })
  }

  // Request dashboard data refresh
  requestDashboardRefresh(): boolean {
    return this.send({
      type: 'dashboard_refresh',
      data: {}
    })
  }

  // Request specific data update
  requestDataUpdate(dataType: string, filters?: any): boolean {
    return this.send({
      type: 'data_update_request',
      data: { dataType, filters }
    })
  }

  // Handle incoming messages
  private handleMessage(message: WebSocketMessage) {
    this.handlers.onMessage?.(message)

    // Route message to specific handlers based on type
    switch (message.type) {
      case 'dashboard_update':
        this.handlers.onDashboardUpdate?.(message.data)
        break
      case 'patient_update':
        this.handlers.onPatientUpdate?.(message.data)
        break
      case 'consultation_update':
        this.handlers.onConsultationUpdate?.(message.data)
        break
      case 'prescription_update':
        this.handlers.onPrescriptionUpdate?.(message.data)
        break
      case 'invoice_update':
        this.handlers.onInvoiceUpdate?.(message.data)
        break
      case 'system_alert':
        this.handlers.onSystemAlert?.(message.data)
        break
      case 'activity_log':
        this.handlers.onActivityLog?.(message.data)
        break
      case 'heartbeat':
        // Respond to heartbeat
        this.send({ type: 'heartbeat_response', data: {} })
        break
      default:
        console.log('Unknown WebSocket message type:', message.type)
    }
  }

  // Start heartbeat
  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'heartbeat', data: {} })
      }
    }, this.config.heartbeatInterval)
  }

  // Stop heartbeat
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // Schedule reconnection
  private scheduleReconnect() {
    this.clearReconnectTimer()

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`)

      this.connect().catch((error) => {
        console.error('Reconnection failed:', error)
      })
    }, this.config.reconnectInterval)
  }

  // Clear reconnect timer
  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.config.maxReconnectAttempts
    }
  }
}

// Create singleton instance
const wsConfig: WebSocketConfig = {
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
}

export const websocketService = new WebSocketService(wsConfig)

// Hook for using WebSocket in React components
export function useWebSocket(handlers: WebSocketEventHandlers = {}) {
  const { user } = useAuth()

  // Set auth token when user changes
  React.useEffect(() => {
    const token = localStorage.getItem('auth_token')
    websocketService.setAuthToken(token)
  }, [user])

  // Set handlers
  React.useEffect(() => {
    websocketService.setHandlers(handlers)
  }, [handlers])

  // Connect on mount
  React.useEffect(() => {
    // Skip WebSocket connection in mock mode (check if we're using mock API)
    const USE_MOCK_DATA = true // Same flag as in api-client.ts
    if (USE_MOCK_DATA) {
      console.log('WebSocket disabled in mock mode')
      return
    }

    if (user) {
      websocketService.connect().catch(console.error)
    }

    return () => {
      websocketService.disconnect()
    }
  }, [user])

  return {
    send: websocketService.send.bind(websocketService),
    subscribe: websocketService.subscribe.bind(websocketService),
    unsubscribe: websocketService.unsubscribe.bind(websocketService),
    requestDashboardRefresh: websocketService.requestDashboardRefresh.bind(websocketService),
    requestDataUpdate: websocketService.requestDataUpdate.bind(websocketService),
    getConnectionStatus: websocketService.getConnectionStatus.bind(websocketService),
    connect: websocketService.connect.bind(websocketService),
    disconnect: websocketService.disconnect.bind(websocketService),
  }
}

// Hook for real-time dashboard updates
export function useRealtimeDashboard() {
  const [dashboardData, setDashboardData] = React.useState<any>(null)
  const [isConnected, setIsConnected] = React.useState(false)
  const [lastUpdate, setLastUpdate] = React.useState<number | null>(null)

  const handlers: WebSocketEventHandlers = {
    onConnect: () => {
      setIsConnected(true)
      // Subscribe to dashboard updates
      websocketService.subscribe(['dashboard_update', 'system_alert'])
    },
    onDisconnect: () => {
      setIsConnected(false)
    },
    onDashboardUpdate: (data) => {
      setDashboardData(data)
      setLastUpdate(Date.now())
    },
    onSystemAlert: (data) => {
      // Handle system alerts
      console.log('System alert received:', data)
    }
  }

  const ws = useWebSocket(handlers)

  return {
    dashboardData,
    isConnected,
    lastUpdate,
    requestRefresh: ws.requestDashboardRefresh,
    connectionStatus: ws.getConnectionStatus(),
  }
}

// Hook for real-time data updates
export function useRealtimeData<T = any>(dataType: string, filters?: any) {
  const [data, setData] = React.useState<T[]>([])
  const [isConnected, setIsConnected] = React.useState(false)
  const [lastUpdate, setLastUpdate] = React.useState<number | null>(null)

  const handlers: WebSocketEventHandlers = {
    onConnect: () => {
      setIsConnected(true)
      // Subscribe to specific data type updates
      websocketService.subscribe([`${dataType}_update`])
    },
    onDisconnect: () => {
      setIsConnected(false)
    },
    [`on${dataType.charAt(0).toUpperCase() + dataType.slice(1)}Update` as keyof WebSocketEventHandlers]: (updateData: any) => {
      setData(updateData)
      setLastUpdate(Date.now())
    }
  }

  const ws = useWebSocket(handlers)

  // Request initial data
  React.useEffect(() => {
    if (isConnected) {
      ws.requestDataUpdate(dataType, filters)
    }
  }, [isConnected, dataType, filters, ws])

  return {
    data,
    isConnected,
    lastUpdate,
    requestUpdate: () => ws.requestDataUpdate(dataType, filters),
    connectionStatus: ws.getConnectionStatus(),
  }
}

export default websocketService
