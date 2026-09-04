import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"
import "./print.css"
import { Providers } from "@/components/providers"
import { ErrorBoundary } from "@/components/error-boundary"

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
          <Providers>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
              {children}
            </Suspense>
          </Providers>
        </ErrorBoundary>
        <ErrorBoundary>
          <Analytics />
        </ErrorBoundary>
      </body>
    </html>
  )
}
