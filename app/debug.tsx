"use client"

import { useEffect } from "react"

export default function DebugPage() {
  useEffect(() => {
    // Log all errors to console
    window.addEventListener('error', (e) => {
      console.error('Global error:', e.error)
    })
    
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled promise rejection:', e.reason)
    })
    
    console.log('✅ Debug page loaded')
    console.log('API URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api')
    
    // Test API connection
    fetch('http://localhost:8080/api/test/database')
      .then(res => res.json())
      .then(data => console.log('✅ API test successful:', data))
      .catch(err => console.error('❌ API test failed:', err))
  }, [])
  
  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
        <div className="space-y-4">
          <div>
            <strong>Environment:</strong> {typeof window !== 'undefined' ? 'Browser' : 'Server'}
          </div>
          <div>
            <strong>API URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'}
          </div>
          <div>
            <strong>Check browser console (F12) for errors</strong>
          </div>
          <a href="/" className="text-blue-600 underline">Go to Login Page</a>
        </div>
      </div>
    </div>
  )
}

