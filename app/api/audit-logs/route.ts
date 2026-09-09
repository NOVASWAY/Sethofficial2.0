import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { z } from "zod"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get("userId")
  const action = searchParams.get("action")
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (userId) where.userId = userId
  if (action) where.action = action

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { timestamp: "desc" },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: logs,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  })
}

const clientAuditSchema = z.object({
  action: z.string().min(1).max(100),
  module: z.string().max(50).optional(),
  resource: z.string().max(50).optional(),
  entity_type: z.string().max(50).optional(),
  entity_id: z.string().max(255).optional(),
  resourceId: z.string().max(255).optional(),
  details: z.record(z.unknown()).optional(),
})

/**
 * Ingest endpoint for the legacy frontend audit context.
 * Previously 404/405 — now persisted to the server audit trail.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = clientAuditSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid audit payload" }, { status: 400 })
    }

    const d = parsed.data
    await writeAudit({
      userId: session.user.id,
      action: d.action,
      resource: d.resource || d.module || d.entity_type || "app",
      resourceId: d.resourceId || d.entity_id || null,
      result: "success",
      details: d.details,
      req,
    })

    return NextResponse.json({ success: true, data: { logged: true } }, { status: 201 })
  } catch (error) {
    console.error("[Audit POST Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
