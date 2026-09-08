"use client"

import { useEffect, useState } from "react"
import { CloudOff, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getPendingCount, processOutbox, startOutboxAutoSync } from "@/lib/offline-outbox"

export function PendingSyncBadge() {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setPending(getPendingCount())
    const onChange = (e: Event) => {
      setPending((e as CustomEvent).detail?.pending ?? getPendingCount())
    }
    window.addEventListener("clinic:outbox-changed", onChange)
    const stop = startOutboxAutoSync((r) => {
      if (r.synced > 0) setPending(r.remaining)
    })
    return () => {
      window.removeEventListener("clinic:outbox-changed", onChange)
      stop()
    }
  }, [])

  if (pending === 0) return null

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await processOutbox()
      setPending(result.remaining)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className="gap-1 border-amber-500 text-amber-700">
        <CloudOff className="h-3 w-3" />
        {pending} pending
      </Badge>
      <Button variant="ghost" size="sm" className="h-8 min-h-[32px]" onClick={handleSync} disabled={syncing}>
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        <span className="sr-only">Sync now</span>
      </Button>
    </div>
  )
}
