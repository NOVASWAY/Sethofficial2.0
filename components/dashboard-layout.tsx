"use client"

import React, { useState, useEffect } from "react"

// Minimal debug version
export function DashboardLayout({ children, role }: { children: React.ReactNode, role: string }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="p-10">Hydrating...</div>

  return (
    <div className="min-h-screen bg-green-50 p-8">
      <h1 className="text-2xl font-bold mb-4">MINIMAL DASHBOARD LAYOUT (DEBUG)</h1>
      <p>Role: {role}</p>
      <div className="border bg-white p-4 rounded shadow">
        {children}
      </div>
    </div>
  )
}
