import Link from "next/link"

export const dynamic = "force-static"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <span className="text-2xl">📶</span>
        </div>
        <h1 className="text-2xl font-bold">You are offline</h1>
        <p className="text-muted-foreground">
          No internet connection. New registrations, queue check-ins, and cash bills
          are saved on this device and will sync automatically when you reconnect.
        </p>
        <p className="text-sm text-muted-foreground">
          M-Pesa payments require a connection and cannot be queued — use cash or
          handwritten receipts during the outage.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Retry connection
        </Link>
      </div>
    </div>
  )
}
