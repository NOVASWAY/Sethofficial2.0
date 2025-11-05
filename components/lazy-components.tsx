/**
 * Lazy-loaded components for dashboard
 * Reduces initial bundle size and improves load times
 */

import { lazy } from 'react'

// Lazy load heavy dashboard components
export const LazyDashboardOverview = lazy(() => 
  import('./dashboard-overview').then(module => ({ default: module.DashboardOverview }))
)

export const LazyPatientManagement = lazy(() => 
  import('./patient-management').then(module => ({ default: module.PatientManagement }))
)

export const LazyAppointmentBooking = lazy(() => 
  import('./appointment-booking').then(module => ({ default: module.AppointmentBooking }))
)

export const LazyInvoiceManagement = lazy(() => 
  import('./invoice-management').then(module => ({ default: module.InvoiceManagement }))
)

export const LazyReportsModule = lazy(() => 
  import('./reports-module').then(module => ({ default: module.ReportsModule }))
)

export const LazyFinancialOverview = lazy(() => 
  import('./financial-overview').then(module => ({ default: module.FinancialOverview }))
)

export const LazyConsultationModule = lazy(() => 
  import('./consultation-module').then(module => ({ default: module.ConsultationModule }))
)

export const LazyServiceCatalog = lazy(() => 
  import('./service-catalog').then(module => ({ default: module.ServiceCatalog }))
)

export const LazyAuditLogs = lazy(() => 
  import('./audit-logs').then(module => ({ default: module.AuditLogs }))
)

export const LazyUserManagement = lazy(() => 
  import('./user-management').then(module => ({ default: module.UserManagement }))
)

export const LazySettingsPage = lazy(() => 
  import('./settings-page').then(module => ({ default: module.SettingsPage }))
)

// Lazy load modals and dialogs
export const LazyPatientImport = lazy(() => 
  import('./patient-import').then(module => ({ default: module.PatientImport }))
)

export const LazySHAClaimTracking = lazy(() => 
  import('./sha-claim-tracking').then(module => ({ default: module.SHAClaimTracking }))
)

/**
 * Lazy loading wrapper with error boundary and loading state
 */
import React, { Suspense, Component, ReactNode } from 'react'
import { Loading } from '@/components/ui/loading'

interface LazyComponentProps {
  children: ReactNode
  fallback?: ReactNode
}

interface LazyComponentState {
  hasError: boolean
  error?: Error
}

export class LazyErrorBoundary extends Component<LazyComponentProps, LazyComponentState> {
  constructor(props: LazyComponentProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): LazyComponentState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy component error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Failed to load component. Please refresh the page.
            </p>
            {this.state.error && (
              <p className="text-xs text-red-500 mt-2">{this.state.error.message}</p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Wrapper component for lazy-loaded components
 */
export function LazyComponentWrapper({ 
  children, 
  fallback = <Loading text="Loading component..." /> 
}: LazyComponentProps) {
  return (
    <LazyErrorBoundary>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </LazyErrorBoundary>
  )
}

/**
 * Hook to preload lazy components
 */
export function usePreloadLazyComponent() {
  const preload = (componentLoader: () => Promise<{ default: React.ComponentType }>) => {
    componentLoader()
  }

  return { preload }
}

