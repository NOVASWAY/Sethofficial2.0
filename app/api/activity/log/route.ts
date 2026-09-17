import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { z } from "zod"

export const dynamic = 'force-dynamic'

const logSchema = z.object({
  action: z.string().min(1).max(100),
  module: z.string().max(50).optional(),
  entity_type: z.string().max(50).optional(),
  entity_id: z.string().max(255).optional(),
  details: z.record(z.unknown()).optional(),
})

const isUuid = (v: unknown) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export const POST = withErrorHandling(async (req, _ctx, session) => {
  const body = await validateBody(req, logSchema)

  const entry = await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: body.action,
      resource: body.module || body.entity_type || "app",
      resourceId: isUuid(body.entity_id) ? body.entity_id : null,
      details: body.details
        ? { ...body.details, ...(body.entity_id && !isUuid(body.entity_id) ? { ref: body.entity_id } : {}) }
        : undefined,
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    },
  })

  return NextResponse.json({ success: true, data: entry }, { status: 201 })
})
