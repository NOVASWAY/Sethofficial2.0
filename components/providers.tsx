"use client"

import type React from "react"
import { SessionProvider } from "next-auth/react"
import { AuthProvider } from "@/contexts/auth-context"
import { ThemeProvider } from "next-themes"
import { LanguageProvider } from "@/contexts/language-context"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
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
