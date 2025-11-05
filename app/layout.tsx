import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"
import "./print.css"
import { Providers } from "@/components/providers"
import { AuthProvider } from "@/contexts/auth-context"
import { AppStateProvider } from "@/contexts/app-state-context"
import { ErrorBoundary } from "@/components/error-boundary"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Seth Medical Clinic - Management System",
  description: "Comprehensive clinic management system for Seth Medical Clinic",
  generator: "v0.app",
  manifest: "/site.webmanifest",
  themeColor: "#FF6B35",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Register service worker for persistent caching
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      import('@/lib/service-worker').then(({ registerServiceWorker }) => {
        registerServiceWorker().catch((error) => {
          console.warn('Service Worker registration failed:', error)
        })
      })
    }
  }, [])
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
            <ErrorBoundary>
              <AuthProvider>
                <Providers>
                  <AppStateProvider>
                    <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
                    <Toaster />
                  </AppStateProvider>
                </Providers>
              </AuthProvider>
            </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
