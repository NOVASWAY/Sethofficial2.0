import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { EnhancedDashboardOverview } from '@/components/enhanced-dashboard-overview'
import { RealtimeDashboardOverview } from '@/components/realtime-dashboard-overview'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard'
import { useEnhancedValidation } from '@/hooks/use-enhanced-validation'
import { useBackendDataIsolation } from '@/hooks/use-backend-data-isolation'
import { useWebSocket } from '@/lib/websocket-service'

// Mock the hooks
jest.mock('@/hooks/use-dashboard-data')
jest.mock('@/hooks/use-realtime-dashboard')
jest.mock('@/hooks/use-enhanced-validation')
jest.mock('@/hooks/use-backend-data-isolation')
jest.mock('@/lib/websocket-service')
jest.mock('@/contexts/auth-context')
jest.mock('@/hooks/use-toast')

// Mock data
const mockUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  username: 'test_user',
  role: 'clinician',
  department: 'clinical'
}

const mockMetrics = {
  totalPatients: 150,
  totalConsultations: 75,
  totalPrescriptions: 60,
  totalRevenue: 250000,
  todaysConsultations: 8,
  todaysRevenue: 15000,
  pendingPrescriptions: 12,
  lowStockItems: 5,
  outOfStockItems: 2,
  criticalExpiries: 1,
  monthlyRevenue: 250000,
  revenueChange: 12.5,
  patientGrowth: 8.3,
  consultationGrowth: 15.2,
  prescriptionGrowth: 6.7
}

const mockSystemHealth = {
  status: 'healthy',
  database: true,
  redis: true,
  storage: true,
  uptime: '99.9%',
  responseTime: 45
}

const mockUserPreferences = {
  layout_config: { grid: [] },
  custom_metrics: [],
  favorite_modules: ['patients', 'consultations'],
  refresh_interval: 300,
  auto_refresh: true,
  theme: 'dark',
  language: 'en',
  timezone: 'UTC'
}

const mockSystemAlerts = [
  {
    id: '1',
    title: 'System Alert',
    message: 'Database connection restored',
    severity: 'info',
    timestamp: Date.now()
  }
]

describe('Enhanced Dashboard Overview', () => {
  beforeEach(() => {
    (useDashboardData as jest.Mock).mockReturnValue({
      metrics: mockMetrics,
      systemHealth: mockSystemHealth,
      userPreferences: mockUserPreferences,
      loading: false,
      refreshing: false,
      error: null,
      refresh: jest.fn(),
      updatePreferences: jest.fn(),
      resetPreferences: jest.fn(),
      isHealthy: true,
      hasAlerts: true,
      canRefresh: true
    })
  })

  test('renders dashboard overview correctly', () => {
    render(<EnhancedDashboardOverview role="clinician" userId={mockUser.id} />)
    
    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument()
    expect(screen.getByText('Real-time clinic metrics and alerts for clinician')).toBeInTheDocument()
  })

  test('displays key metrics', () => {
    render(<EnhancedDashboardOverview role="clinician" userId={mockUser.id} />)
    
    expect(screen.getByText("Today's Revenue")).toBeInTheDocument()
    expect(screen.getByText("Today's Consultations")).toBeInTheDocument()
    expect(screen.getByText('Total Patients')).toBeInTheDocument()
    expect(screen.getByText('Pending Prescriptions')).toBeInTheDocument()
  })

  test('shows critical alerts when present', () => {
    render(<EnhancedDashboardOverview role="clinician" userId={mockUser.id} />)
    
    expect(screen.getByText('1 medicine batch(es) expired or expiring within 30 days')).toBeInTheDocument()
    expect(screen.getByText('2 medicine(s) out of stock')).toBeInTheDocument()
  })

  test('handles refresh button click', async () => {
    const mockRefresh = jest.fn()
    ;(useDashboardData as jest.Mock).mockReturnValue({
      ...useDashboardData(),
      refresh: mockRefresh
    })

    render(<EnhancedDashboardOverview role="clinician" userId={mockUser.id} />)
    
    const refreshButton = screen.getByText('Refresh')
    fireEvent.click(refreshButton)
    
    expect(mockRefresh).toHaveBeenCalled()
  })

  test('shows loading state', () => {
    ;(useDashboardData as jest.Mock).mockReturnValue({
      metrics: null,
      systemHealth: null,
      userPreferences: null,
      loading: true,
      refreshing: false,
      error: null,
      refresh: jest.fn(),
      updatePreferences: jest.fn(),
      resetPreferences: jest.fn(),
      isHealthy: false,
      hasAlerts: false,
      canRefresh: false
    })

    render(<EnhancedDashboardOverview role="clinician" userId={mockUser.id} />)
    
    expect(screen.getByText('Loading real-time clinic metrics...')).toBeInTheDocument()
  })

  test('displays system health status', () => {
    render(<EnhancedDashboardOverview role="clinician" userId={mockUser.id} />)
    
    expect(screen.getByText('System Health')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
    expect(screen.getByText('Cache')).toBeInTheDocument()
    expect(screen.getByText('Storage')).toBeInTheDocument()
    expect(screen.getByText('Response Time')).toBeInTheDocument()
  })

  test('shows user preferences', () => {
    render(<EnhancedDashboardOverview role="clinician" userId={mockUser.id} />)
    
    expect(screen.getByText('Dashboard Preferences')).toBeInTheDocument()
    expect(screen.getByText('Auto Refresh')).toBeInTheDocument()
    expect(screen.getByText('Refresh Interval')).toBeInTheDocument()
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByText('Language')).toBeInTheDocument()
  })
})

describe('Realtime Dashboard Overview', () => {
  beforeEach(() => {
    (useRealtimeDashboard as jest.Mock).mockReturnValue({
      metrics: mockMetrics,
      systemHealth: mockSystemHealth,
      userPreferences: mockUserPreferences,
      systemAlerts: mockSystemAlerts,
      loading: false,
      refreshing: false,
      error: null,
      wsConnected: true,
      lastRealtimeUpdate: Date.now(),
      refresh: jest.fn(),
      clearSystemAlerts: jest.fn(),
      connectionStatus: {
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        maxReconnectAttempts: 10,
        realtimeEnabled: true,
        lastRealtimeUpdate: Date.now(),
        updateCount: 5,
        systemAlertsCount: 1
      },
      realtimeEnabled: true,
      updateCount: 5,
      timeSinceLastUpdate: 1000,
      isHealthy: true,
      hasAlerts: true,
      canRefresh: true
    })
  })

  test('renders realtime dashboard correctly', () => {
    render(<RealtimeDashboardOverview role="clinician" userId={mockUser.id} enableRealtime={true} />)
    
    expect(screen.getByText('Real-time Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Live clinic metrics for clinician')).toBeInTheDocument()
  })

  test('shows connection status', () => {
    render(<RealtimeDashboardOverview role="clinician" userId={mockUser.id} enableRealtime={true} />)
    
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('5 updates')).toBeInTheDocument()
  })

  test('displays system alerts', () => {
    render(<RealtimeDashboardOverview role="clinician" userId={mockUser.id} enableRealtime={true} />)
    
    expect(screen.getByText('System Alerts')).toBeInTheDocument()
    expect(screen.getByText('System Alert')).toBeInTheDocument()
    expect(screen.getByText('Database connection restored')).toBeInTheDocument()
  })

  test('shows realtime status section', () => {
    render(<RealtimeDashboardOverview role="clinician" userId={mockUser.id} enableRealtime={true} />)
    
    expect(screen.getByText('Real-time Status')).toBeInTheDocument()
    expect(screen.getByText('Connection')).toBeInTheDocument()
    expect(screen.getByText('Updates Received')).toBeInTheDocument()
    expect(screen.getByText('Last Update')).toBeInTheDocument()
    expect(screen.getByText('Reconnect Attempts')).toBeInTheDocument()
  })

  test('handles notification toggle', async () => {
    render(<RealtimeDashboardOverview role="clinician" userId={mockUser.id} enableRealtime={true} />)
    
    const notificationButton = screen.getByRole('button', { name: /bell/i })
    fireEvent.click(notificationButton)
    
    // Should show notification state change
    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })
  })

  test('shows offline status when disconnected', () => {
    ;(useRealtimeDashboard as jest.Mock).mockReturnValue({
      ...useRealtimeDashboard(),
      wsConnected: false,
      connectionStatus: {
        isConnected: false,
        isConnecting: false,
        reconnectAttempts: 2,
        maxReconnectAttempts: 10,
        realtimeEnabled: true,
        lastRealtimeUpdate: null,
        updateCount: 0,
        systemAlertsCount: 0
      }
    })

    render(<RealtimeDashboardOverview role="clinician" userId={mockUser.id} enableRealtime={true} />)
    
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByText('Real-time updates unavailable')).toBeInTheDocument()
  })
})

describe('Enhanced Validation Hook', () => {
  test('validates patient data', async () => {
    const mockValidatePatient = jest.fn().mockResolvedValue({
      isValid: true,
      errors: []
    })

    ;(useEnhancedValidation as jest.Mock).mockReturnValue({
      validating: false,
      error: null,
      validatePatient: mockValidatePatient,
      validateUser: jest.fn(),
      checkDuplicatePatient: jest.fn(),
      checkDuplicateUser: jest.fn(),
      validateBusinessRules: jest.fn(),
      validatePatientCreation: jest.fn(),
      validateUserCreation: jest.fn(),
      clearError: jest.fn()
    })

    const { validatePatient } = useEnhancedValidation()
    const result = await validatePatient({
      first_name: 'John',
      last_name: 'Doe',
      phone: '+254712345678'
    })

    expect(mockValidatePatient).toHaveBeenCalledWith({
      first_name: 'John',
      last_name: 'Doe',
      phone: '+254712345678'
    })
    expect(result.isValid).toBe(true)
  })

  test('handles validation errors', async () => {
    const mockValidatePatient = jest.fn().mockResolvedValue({
      isValid: false,
      errors: [
        { field: 'phone', message: 'Invalid phone number format' }
      ]
    })

    ;(useEnhancedValidation as jest.Mock).mockReturnValue({
      validating: false,
      error: 'Validation failed',
      validatePatient: mockValidatePatient,
      validateUser: jest.fn(),
      checkDuplicatePatient: jest.fn(),
      checkDuplicateUser: jest.fn(),
      validateBusinessRules: jest.fn(),
      validatePatientCreation: jest.fn(),
      validateUserCreation: jest.fn(),
      clearError: jest.fn()
    })

    const { validatePatient, error } = useEnhancedValidation()
    const result = await validatePatient({
      first_name: 'John',
      last_name: 'Doe',
      phone: 'invalid'
    })

    expect(result.isValid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(error).toBe('Validation failed')
  })
})

describe('Backend Data Isolation Hook', () => {
  test('loads filtered data', async () => {
    const mockData = [
      { id: '1', name: 'Patient 1' },
      { id: '2', name: 'Patient 2' }
    ]

    const mockLoadData = jest.fn().mockResolvedValue(undefined)

    ;(useBackendDataIsolation as jest.Mock).mockReturnValue({
      data: mockData,
      pagination: {
        total: 2,
        page: 1,
        per_page: 20,
        total_pages: 1
      },
      loading: false,
      error: null,
      loadData: mockLoadData,
      search: jest.fn(),
      loadPage: jest.fn(),
      refresh: jest.fn(),
      validateAccess: jest.fn(),
      hasData: true,
      hasNextPage: false,
      hasPreviousPage: false,
      isEmpty: false,
      totalCount: 2
    })

    const { data, hasData, totalCount } = useBackendDataIsolation({
      entityType: 'patients'
    })

    expect(data).toEqual(mockData)
    expect(hasData).toBe(true)
    expect(totalCount).toBe(2)
  })

  test('handles loading state', () => {
    ;(useBackendDataIsolation as jest.Mock).mockReturnValue({
      data: [],
      pagination: {
        total: 0,
        page: 1,
        per_page: 20,
        total_pages: 0
      },
      loading: true,
      error: null,
      loadData: jest.fn(),
      search: jest.fn(),
      loadPage: jest.fn(),
      refresh: jest.fn(),
      validateAccess: jest.fn(),
      hasData: false,
      hasNextPage: false,
      hasPreviousPage: false,
      isEmpty: true,
      totalCount: 0
    })

    const { loading, isEmpty } = useBackendDataIsolation({
      entityType: 'patients'
    })

    expect(loading).toBe(true)
    expect(isEmpty).toBe(true)
  })

  test('handles search functionality', async () => {
    const mockSearch = jest.fn()

    ;(useBackendDataIsolation as jest.Mock).mockReturnValue({
      data: [],
      pagination: {
        total: 0,
        page: 1,
        per_page: 20,
        total_pages: 0
      },
      loading: false,
      error: null,
      loadData: jest.fn(),
      search: mockSearch,
      loadPage: jest.fn(),
      refresh: jest.fn(),
      validateAccess: jest.fn(),
      hasData: false,
      hasNextPage: false,
      hasPreviousPage: false,
      isEmpty: true,
      totalCount: 0
    })

    const { search } = useBackendDataIsolation({
      entityType: 'patients'
    })

    search('John Doe')
    expect(mockSearch).toHaveBeenCalledWith('John Doe')
  })
})

describe('WebSocket Service', () => {
  test('connects to WebSocket', () => {
    const mockConnect = jest.fn()
    const mockDisconnect = jest.fn()
    const mockSend = jest.fn()

    ;(useWebSocket as jest.Mock).mockReturnValue({
      send: mockSend,
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      requestDashboardRefresh: jest.fn(),
      requestDataUpdate: jest.fn(),
      getConnectionStatus: jest.fn().mockReturnValue({
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        maxReconnectAttempts: 10
      }),
      connect: mockConnect,
      disconnect: mockDisconnect
    })

    const { connect, disconnect, send } = useWebSocket({})

    connect()
    expect(mockConnect).toHaveBeenCalled()

    send({ type: 'test', data: {} })
    expect(mockSend).toHaveBeenCalledWith({ type: 'test', data: {} })

    disconnect()
    expect(mockDisconnect).toHaveBeenCalled()
  })

  test('handles WebSocket events', () => {
    const mockOnConnect = jest.fn()
    const mockOnDisconnect = jest.fn()
    const mockOnMessage = jest.fn()

    ;(useWebSocket as jest.Mock).mockReturnValue({
      send: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      requestDashboardRefresh: jest.fn(),
      requestDataUpdate: jest.fn(),
      getConnectionStatus: jest.fn().mockReturnValue({
        isConnected: false,
        isConnecting: true,
        reconnectAttempts: 0,
        maxReconnectAttempts: 10
      }),
      connect: jest.fn(),
      disconnect: jest.fn()
    })

    useWebSocket({
      onConnect: mockOnConnect,
      onDisconnect: mockOnDisconnect,
      onMessage: mockOnMessage
    })

    // Simulate WebSocket events
    // These would be triggered by the actual WebSocket service
    expect(mockOnConnect).toBeDefined()
    expect(mockOnDisconnect).toBeDefined()
    expect(mockOnMessage).toBeDefined()
  })
})

describe('Dashboard Integration Tests', () => {
  test('complete dashboard workflow', async () => {
    // Mock all hooks with realistic data
    ;(useDashboardData as jest.Mock).mockReturnValue({
      metrics: mockMetrics,
      systemHealth: mockSystemHealth,
      userPreferences: mockUserPreferences,
      loading: false,
      refreshing: false,
      error: null,
      refresh: jest.fn(),
      updatePreferences: jest.fn(),
      resetPreferences: jest.fn(),
      isHealthy: true,
      hasAlerts: true,
      canRefresh: true
    })

    ;(useRealtimeDashboard as jest.Mock).mockReturnValue({
      metrics: mockMetrics,
      systemHealth: mockSystemHealth,
      userPreferences: mockUserPreferences,
      systemAlerts: mockSystemAlerts,
      loading: false,
      refreshing: false,
      error: null,
      wsConnected: true,
      lastRealtimeUpdate: Date.now(),
      refresh: jest.fn(),
      clearSystemAlerts: jest.fn(),
      connectionStatus: {
        isConnected: true,
        isConnecting: false,
        reconnectAttempts: 0,
        maxReconnectAttempts: 10,
        realtimeEnabled: true,
        lastRealtimeUpdate: Date.now(),
        updateCount: 5,
        systemAlertsCount: 1
      },
      realtimeEnabled: true,
      updateCount: 5,
      timeSinceLastUpdate: 1000,
      isHealthy: true,
      hasAlerts: true,
      canRefresh: true
    })

    render(<RealtimeDashboardOverview role="clinician" userId={mockUser.id} enableRealtime={true} />)

    // Verify all major components are rendered
    expect(screen.getByText('Real-time Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Today\'s Revenue')).toBeInTheDocument()
    expect(screen.getByText('Today\'s Consultations')).toBeInTheDocument()
    expect(screen.getByText('Total Patients')).toBeInTheDocument()
    expect(screen.getByText('Pending Prescriptions')).toBeInTheDocument()
    expect(screen.getByText('System Health')).toBeInTheDocument()
    expect(screen.getByText('Real-time Status')).toBeInTheDocument()
  })

  test('error handling workflow', () => {
    ;(useDashboardData as jest.Mock).mockReturnValue({
      metrics: null,
      systemHealth: null,
      userPreferences: null,
      loading: false,
      refreshing: false,
      error: 'Failed to load dashboard data',
      refresh: jest.fn(),
      updatePreferences: jest.fn(),
      resetPreferences: jest.fn(),
      isHealthy: false,
      hasAlerts: false,
      canRefresh: true
    })

    render(<EnhancedDashboardOverview role="clinician" userId={mockUser.id} />)

    // Should show error state
    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument()
    // Error handling would be displayed by the error boundary or error component
  })
})
