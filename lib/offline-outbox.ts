"use client"

export interface OutboxEntry {
  id: string
  endpoint: string
  method: string
  body: string
  label: string
  createdAt: string
  attempts: number
}

const STORAGE_KEY = "clinic_offline_outbox"
const MAX_ATTEMPTS = 10

// POST endpoints safe to queue offline. Money-moving M-Pesa/STK and auth
// endpoints are deliberately excluded — they require a live connection.
const QUEUEABLE = [
  { match: (ep: string, m: string) => m === "POST" && ep === "/patients", label: "Patient registration" },
  { match: (ep: string, m: string) => m === "POST" && ep === "/appointments", label: "Appointment" },
  { match: (ep: string, m: string) => m === "POST" && ep === "/invoices", label: "Cash bill" },
  { match: (ep: string, m: string) => m === "POST" && /^\/patients\/[^/]+\/allergies$/.test(ep), label: "Allergy note" },
]

export function isQueueable(endpoint: string, method: string): string | null {
  const rule = QUEUEABLE.find((r) => r.match(endpoint, method))
  return rule ? rule.label : null
}

export class OfflineQueuedError extends Error {
  entryId: string
  constructor(label: string, entryId: string) {
    super(`${label} saved on this device. It will sync automatically when you reconnect.`)
    this.name = "OfflineQueuedError"
    this.entryId = entryId
  }
}

function readQueue(): OutboxEntry[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
  } catch {
    return []
  }
}

function writeQueue(entries: OutboxEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  window.dispatchEvent(new CustomEvent("clinic:outbox-changed", { detail: { pending: entries.length } }))
}

export function getPendingCount(): number {
  return readQueue().length
}

export function enqueueOffline(endpoint: string, method: string, body: string, label: string): OutboxEntry {
  const entry: OutboxEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    endpoint,
    method,
    body,
    label,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
  const queue = readQueue()
  queue.push(entry)
  writeQueue(queue)
  return entry
}

export interface SyncResult {
  synced: number
  failed: number
  remaining: number
}

export async function processOutbox(): Promise<SyncResult> {
  const queue = readQueue()
  let synced = 0
  let failed = 0
  const remaining: OutboxEntry[] = []

  for (const entry of queue) {
    if (entry.attempts >= MAX_ATTEMPTS) {
      failed++
      remaining.push(entry)
      continue
    }
    try {
      const res = await fetch(`/api${entry.endpoint}`, {
        method: entry.method,
        headers: { "Content-Type": "application/json" },
        body: entry.body,
      })
      if (res.ok) {
        synced++
      } else {
        failed++
        remaining.push({ ...entry, attempts: entry.attempts + 1 })
      }
    } catch {
      // Still offline — keep entry, stop processing further to preserve order
      remaining.push(entry)
      const idx = queue.indexOf(entry)
      remaining.push(...queue.slice(idx + 1))
      failed += queue.length - idx
      break
    }
  }

  writeQueue(remaining)
  return { synced, failed, remaining: remaining.length }
}

export function startOutboxAutoSync(onSync?: (r: SyncResult) => void): () => void {
  if (typeof window === "undefined") return () => {}
  const handler = async () => {
    if (!navigator.onLine) return
    const result = await processOutbox().catch(() => null)
    if (result && onSync) onSync(result)
  }
  window.addEventListener("online", handler)
  // Opportunistic retry shortly after load
  const timer = setTimeout(handler, 5000)
  return () => {
    window.removeEventListener("online", handler)
    clearTimeout(timer)
  }
}
