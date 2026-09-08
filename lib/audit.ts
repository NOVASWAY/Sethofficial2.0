import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"

export interface AuditEntry {
  userId?: string | null
  action: string
  resource: string
  resourceId?: string | null
  result: "success" | "failure" | "denied"
  details?: Record<string, unknown>
  req?: NextRequest
}

function clientIp(req?: NextRequest): string | undefined {
  if (!req) return undefined
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || undefined
}

/** Best-effort server audit write. Never throws — audit must not break care. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId || null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId || null,
        result: entry.result,
        details: entry.details ? JSON.parse(JSON.stringify(entry.details)) : undefined,
        ipAddress: clientIp(entry.req),
        userAgent: entry.req?.headers.get("user-agent") || undefined,
      },
    })
  } catch (error) {
    console.error("[Audit Write Failed]", entry.action, entry.resource, error instanceof Error ? error.message : error)
  }
}
