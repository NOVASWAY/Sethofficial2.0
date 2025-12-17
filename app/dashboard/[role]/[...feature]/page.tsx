'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { DashboardLayout } from '@/components/dashboard-layout'
import { useAuth } from '@/contexts/auth-context'
import { CardSkeleton, PatientListSkeleton } from '@/components/ui/loading'

// Feature component mapping - lazy load all components
const featureComponents: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'patients': () => import('@/components/patient-management').then(mod => ({ default: mod.PatientManagement })),
  'appointments': () => import('@/components/appointment-booking').then(mod => ({ default: mod.AppointmentBooking })),
  'billing': () => import('@/app/dashboard/_role_backup/billing/page').then(mod => ({ default: mod.default })),
  'queue': () => import('@/components/queue-management').then(mod => ({ default: mod.QueueManagement })),
  'consultation': () => import('@/components/consultation-module').then(mod => ({ default: mod.ConsultationModule })),
  'pharmacy': () => import('@/components/pharmacy-management').then(mod => ({ default: mod.PharmacyManagement })),
  'inventory': () => import('@/app/dashboard/_role_backup/inventory/page').then(mod => ({ default: mod.default })),
  'prescriptions': () => import('@/app/dashboard/_role_backup/prescriptions/page').then(mod => ({ default: mod.default })),
  'visits': () => import('@/app/dashboard/_role_backup/visits/page').then(mod => ({ default: mod.default })),
  'registration': () => import('@/app/dashboard/_role_backup/registration/page').then(mod => ({ default: mod.default })),
  'invoices': () => import('@/app/dashboard/_role_backup/invoices/page').then(mod => ({ default: mod.default })),
  'reports': () => import('@/app/dashboard/_role_backup/reports/page').then(mod => ({ default: mod.default })),
  'users': () => import('@/app/dashboard/_role_backup/users/page').then(mod => ({ default: mod.default })),
  'settings': () => import('@/app/dashboard/_role_backup/settings/page').then(mod => ({ default: mod.default })),
  'lab': () => import('@/app/dashboard/_role_backup/lab/page').then(mod => ({ default: mod.default })),
  'pharmacy-dispensing': () => import('@/app/dashboard/_role_backup/pharmacy-dispensing/page').then(mod => ({ default: mod.default })),
  'financial-overview': () => import('@/app/dashboard/_role_backup/financial-overview/page').then(mod => ({ default: mod.default })),
  'sha-tracking': () => import('@/app/dashboard/_role_backup/sha-tracking/page').then(mod => ({ default: mod.default })),
  'stock-receiving': () => import('@/app/dashboard/_role_backup/stock-receiving/page').then(mod => ({ default: mod.default })),
  'stock-reconciliation': () => import('@/app/dashboard/_role_backup/stock-reconciliation/page').then(mod => ({ default: mod.default })),
  'expiry-alerts': () => import('@/app/dashboard/_role_backup/expiry-alerts/page').then(mod => ({ default: mod.default })),
  'services': () => import('@/app/dashboard/_role_backup/services/page').then(mod => ({ default: mod.default })),
  'medicines': () => import('@/app/dashboard/_role_backup/medicines/page').then(mod => ({ default: mod.default })),
  'inventory-reports': () => import('@/app/dashboard/_role_backup/inventory-reports/page').then(mod => ({ default: mod.default })),
  'workflow': () => import('@/app/dashboard/_role_backup/workflow/page').then(mod => ({ default: mod.default })),
  'audit-logs': () => import('@/app/dashboard/_role_backup/audit-logs/page').then(mod => ({ default: mod.default })),
}

// Handle nested routes like lab/queue, lab/results
const nestedFeatureComponents: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
  'lab/queue': () => import('@/app/dashboard/_role_backup/lab/queue/page').then(mod => ({ default: mod.default })),
  'lab/results': () => import('@/app/dashboard/_role_backup/lab/results/page').then(mod => ({ default: mod.default })),
}

function FeatureContent() {
  const params = useParams()
  const { user } = useAuth()
  
  const role = params?.role as string | undefined
  const feature = params?.feature as string[] | string | undefined
  
  // Determine the feature key
  let featureKey: string | undefined
  if (Array.isArray(feature)) {
    featureKey = feature.join('/')
  } else if (feature) {
    featureKey = feature
  }
  
  // Debug: Log the feature key and available features
  React.useEffect(() => {
    if (featureKey) {
      console.log('[FeaturePage] Feature key:', featureKey)
      console.log('[FeaturePage] Available features:', Object.keys(featureComponents))
      console.log('[FeaturePage] Nested features:', Object.keys(nestedFeatureComponents))
      console.log('[FeaturePage] User role:', user?.role)
      console.log('[FeaturePage] User permissions:', user?.permissions)
    }
  }, [featureKey, user?.role, user?.permissions])
  
  // Check nested routes first (e.g., lab/queue, lab/results)
  const ComponentLoader = featureKey && nestedFeatureComponents[featureKey]
    ? nestedFeatureComponents[featureKey]
    : featureKey && featureComponents[featureKey]
    ? featureComponents[featureKey]
    : null
  
  if (!ComponentLoader) {
    console.warn('[FeaturePage] Component not found for feature:', featureKey)
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Page Not Found</h1>
          <p className="text-muted-foreground">
            The page "{featureKey || 'unknown'}" could not be found.
          </p>
          <p className="text-xs text-muted-foreground">
            Available features: {Object.keys(featureComponents).join(', ')}
          </p>
          <p className="text-xs text-muted-foreground">
            Nested features: {Object.keys(nestedFeatureComponents).join(', ')}
          </p>
        </div>
      </div>
    )
  }
  
  const DynamicComponent = dynamic(ComponentLoader, {
    loading: () => <CardSkeleton />,
    ssr: false,
  })
  
  const dashboardRole = role || user?.role || 'receptionist'
  
  // Some components need the role prop, others don't
  // React components can safely ignore extra props they don't use
  try {
    return <DynamicComponent role={dashboardRole} />
  } catch (error) {
    console.error('[FeaturePage] Error loading component:', error)
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Error Loading Page</h1>
          <p className="text-muted-foreground">
            There was an error loading the "{featureKey || 'unknown'}" page.
          </p>
          <p className="text-xs text-muted-foreground">
            Please check the console for more details.
          </p>
        </div>
      </div>
    )
  }
}

export default function FeaturePage() {
  const params = useParams()
  const { user, isLoading, isAuthenticated } = useAuth()
  
  const role = params?.role as string | undefined
  const dashboardRole = role || user?.role || 'receptionist'
  
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }
  
  return (
    <DashboardLayout role={dashboardRole}>
      <Suspense fallback={<CardSkeleton />}>
        <FeatureContent />
      </Suspense>
    </DashboardLayout>
  )
}

