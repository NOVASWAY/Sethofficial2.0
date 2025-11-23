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
import { ServiceWorkerRegistration } from "@/components/service-worker-registration"

export const metadata: Metadata = {
  title: "Seth Medical Clinic - Management System",
  description: "Comprehensive clinic management system for Seth Medical Clinic",
  generator: "v0.app",
  manifest: "/site.webmanifest",
  themeColor: "#FF6B35",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/favicon.svg',
  },
  // Note: This is a web app, not an installable app
  // appleWebApp settings are for browser display optimization only
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
            <ErrorBoundary>
              <AuthProvider>
                <Providers>
                  <AppStateProvider>
                    <ServiceWorkerRegistration />
                    <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
                    <Toaster />
                  </AppStateProvider>
                </Providers>
              </AuthProvider>
            </ErrorBoundary>
        <ErrorBoundary>
          <Analytics />
        </ErrorBoundary>
      </body>
    </html>
  )
}
