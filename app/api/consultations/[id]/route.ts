import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { z } from "zod"
import { writeAudit } from "@/lib/audit"

const consultationUpdateSchema = z.object({
  status: z.enum(["in_progress", "completed", "cancelled"]).optional(),
  diagnosis: z.string().optional(),
  treatmentPlan: z.string().optional(),
  followUpDate: z.string().optional(),
  notes: z.string().optional(),
})

export const GET = withErrorHandling(async (req, ctx) => {
  const consultation = await prisma.consultation.findUnique({
    where: { id: ctx.params.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
    },
  })
  if (!consultation) {
    return NextResponse.json({ success: false, error: "Consultation not found" }, { status: 404 })
  }
  return NextResponse.json({ success: true, data: consultation })
})

export const PUT = withErrorHandling(async (req, ctx, session) => {
  const body = await validateBody(req, consultationUpdateSchema)

  const existing = await prisma.consultation.findUnique({ where: { id: ctx.params.id } })
  if (!existing) {
    return NextResponse.json({ success: false, error: "Consultation not found" }, { status: 404 })
  }

  // Only clinicians/doctors/admins may close or cancel a visit
  if (body.status && body.status !== "in_progress") {
    const allowed = ["clinician", "doctor", "admin"]
    if (!allowed.includes(session.user.role)) {
      return NextResponse.json({ success: false, error: "Only clinicians can close visits" }, { status: 403 })
    }
    if (existing.status === "completed" || existing.status === "cancelled") {
      return NextResponse.json({ success: false, error: `Visit is already ${existing.status}` }, { status: 400 })
    }
  }

  const consultation = await prisma.consultation.update({
    where: { id: ctx.params.id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.diagnosis !== undefined && { diagnosis: body.diagnosis }),
      ...(body.treatmentPlan !== undefined && { treatmentPlan: body.treatmentPlan }),
      ...(body.followUpDate && { followUpDate: new Date(body.followUpDate) }),
      ...(body.notes !== undefined && { notes: body.notes }),
    },
  })

  if (body.status) {
    writeAudit({
      userId: session.user.id,
      action: `consultation.${body.status}`,
      resource: "consultation",
      resourceId: ctx.params.id,
      result: "success",
      details: { from: existing.status, to: body.status },
      req,
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, data: consultation })
})
