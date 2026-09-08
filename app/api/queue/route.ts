import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { queueEntrySchema } from "@/lib/validation"
import { apiCache } from "@/lib/cache"
import { writeAudit } from "@/lib/audit"

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export const GET = withErrorHandling(async (req) => {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  const status = searchParams.get("status")

  const day = date ? new Date(date) : new Date()
  const start = new Date(day)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const where: Record<string, unknown> = {
    queueDate: { gte: start, lt: end },
  }
  if (status) where.status = status

  const entries = await prisma.queueEntry.findMany({
    where,
    orderBy: [{ priority: "desc" }, { checkedInAt: "asc" }],
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true } },
    },
  })

  return NextResponse.json({ success: true, data: entries })
})

export const POST = withErrorHandling(async (req, _ctx, session) => {
  const body = await validateBody(req, queueEntrySchema)
  const { start, end } = todayRange()

  const count = await prisma.queueEntry.count({
    where: { queueDate: { gte: start, lt: end } },
  })
  const queueNumber = `Q-${String(count + 1).padStart(3, "0")}`

  const entry = await prisma.queueEntry.create({
    data: {
      queueNumber,
      queueDate: start,
      patientId: body.patientId,
      patientName: body.patientName,
      phone: body.phone,
      appointmentId: body.appointmentId,
      priority: body.priority || "normal",
      notes: body.notes,
      createdById: session.user.id,
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
    },
  })

  apiCache.invalidate("^dashboard:metrics")

  writeAudit({
    userId: session.user.id,
    action: "queue.checkin",
    resource: "queue",
    resourceId: entry.id,
    result: "success",
    details: { queueNumber, patientName: body.patientName },
    req,
  }).catch(() => {})

  return NextResponse.json({ success: true, data: entry }, { status: 201 })
})
