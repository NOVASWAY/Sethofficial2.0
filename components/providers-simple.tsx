"use client"

import type React from "react"
import { ThemeProvider } from "next-themes"
import { LanguageProvider } from "@/contexts/language-context"

// Simplified providers for testing
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
        {children}
      </LanguageProvider>
    </ThemeProvider>
  )
}

