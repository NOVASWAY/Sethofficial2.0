"use client"

import type React from "react"
import { ThemeProvider } from "next-themes"
import { InventoryProvider } from "@/contexts/inventory-context"
import { InventoryProviderEnhanced } from "@/contexts/inventory-context-enhanced"
import { PatientProvider } from "@/contexts/patient-context"
import { PatientProviderEnhanced } from "@/contexts/patient-context-enhanced"
import { WorkflowProvider } from "@/contexts/workflow-context"
import { WorkflowProviderEnhanced } from "@/contexts/workflow-context-enhanced"
import { AppointmentProvider } from "@/contexts/appointment-context"
import { AuditLogProvider } from "@/contexts/audit-log-context"
import { InvoiceProvider } from "@/contexts/invoice-context"
import { UserManagementProvider } from "@/contexts/user-management-context"
import { SettingsProvider } from "@/contexts/settings-context"
import { PurchaseOrderProvider } from "@/contexts/purchase-order-context"
import { LanguageProvider } from "@/contexts/language-context"
import { BackupSchedulerProvider } from "@/contexts/backup-scheduler-context"
import { EmailServiceProvider } from "@/contexts/email-service-context"
import { SMSServiceProvider } from "@/contexts/sms-service-context"

// Lazy load WebSocketProvider to avoid module initialization issues during SSR
import dynamic from 'next/dynamic'
const WebSocketProvider = dynamic(
  () => import('@/contexts/websocket-context').then(mod => ({ default: mod.WebSocketProvider })),
  { 
    ssr: false,
    loading: () => null // Don't show loading state, just render children
  }
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={["light", "dark", "clinic"]}
      storageKey="clinic-theme"
    >
      <LanguageProvider>
        <SettingsProvider>
           <InventoryProvider>
            <InventoryProviderEnhanced>
               <PatientProvider>
                <PatientProviderEnhanced>
                   <WorkflowProvider>
                    <WorkflowProviderEnhanced>
                       <AppointmentProvider>
                        <InvoiceProvider>
                           <UserManagementProvider>
                            <AuditLogProvider>
                              <PurchaseOrderProvider>
                                    <BackupSchedulerProvider>
                                      <EmailServiceProvider>
                                        <SMSServiceProvider>
                                          <WebSocketProvider>
                                            {children}
                                          </WebSocketProvider>
                                        </SMSServiceProvider>
                                      </EmailServiceProvider>
                                    </BackupSchedulerProvider>
                              </PurchaseOrderProvider>
                            </AuditLogProvider>
                           </UserManagementProvider>
                        </InvoiceProvider>
                       </AppointmentProvider>
                    </WorkflowProviderEnhanced>
                   </WorkflowProvider>
                </PatientProviderEnhanced>
               </PatientProvider>
            </InventoryProviderEnhanced>
           </InventoryProvider>
        </SettingsProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
