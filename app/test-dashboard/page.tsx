"use client"

export default function TestDashboardPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-4">
        <h1 className="text-4xl font-bold text-center">✅ Test Dashboard Works!</h1>
        <p className="text-center text-muted-foreground">
          This is a simple test page to verify routing is working.
        </p>
        <div className="bg-card border rounded-lg p-6 space-y-2">
          <p><strong>Path:</strong> /test-dashboard</p>
          <p><strong>Status:</strong> Page renders successfully</p>
          <p><strong>Next.js:</strong> Running correctly</p>
        </div>
        <div className="text-center">
          <a href="/" className="text-primary hover:underline">
            ← Back to Login
          </a>
        </div>
      </div>
    </div>
  )
}

