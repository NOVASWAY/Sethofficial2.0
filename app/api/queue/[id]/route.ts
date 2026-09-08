import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { queueStatusSchema } from "@/lib/validation"
import { writeAudit } from "@/lib/audit"

export const PUT = withErrorHandling(async (req, ctx, session) => {
  const id = ctx.params.id
  const body = await validateBody(req, queueStatusSchema)

  const stamps: Record<string, Date> = {}
  if (body.status === "called") stamps.calledAt = new Date()
  if (body.status === "completed" || body.status === "cancelled") stamps.completedAt = new Date()

  const entry = await prisma.queueEntry.update({
    where: { id },
    data: { status: body.status, ...stamps },
  })

  writeAudit({
    userId: session.user.id,
    action: `queue.${body.status}`,
    resource: "queue",
    resourceId: id,
    result: "success",
    details: { queueNumber: entry.queueNumber },
    req,
  }).catch(() => {})

  return NextResponse.json({ success: true, data: entry })
})

export const DELETE = withErrorHandling(async (req, ctx, session) => {
  const id = ctx.params.id
  await prisma.queueEntry.delete({ where: { id } })

  writeAudit({
    userId: session.user.id,
    action: "queue.removed",
    resource: "queue",
    resourceId: id,
    result: "success",
    req,
  }).catch(() => {})

  return NextResponse.json({ success: true, data: { deleted: true } })
})
