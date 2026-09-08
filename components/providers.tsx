"use client"

import type React from "react"
import { useEffect } from "react"
import { SessionProvider } from "next-auth/react"
import { AuthProvider } from "@/contexts/auth-context"
import { ThemeProvider } from "next-themes"
import { LanguageProvider } from "@/contexts/language-context"
import { Toaster } from "sonner"
import { registerServiceWorker } from "@/lib/service-worker"

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker().catch(() => {})
  }, [])
  return (
    <SessionProvider>
      <AuthProvider>
        <LanguageProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            themes={["light", "dark", "clinic"]}
            storageKey="clinic-theme"
          >
            {children}
            <Toaster position="top-right" richColors />
          </ThemeProvider>
        </LanguageProvider>
      </AuthProvider>
    </SessionProvider>
  )
}
