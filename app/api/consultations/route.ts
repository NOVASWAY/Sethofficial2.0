import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { consultationSchema } from "@/lib/validation"

export const GET = withErrorHandling(async (req) => {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const doctorId = searchParams.get("doctorId")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (patientId) where.patientId = patientId
  if (doctorId) where.doctorId = doctorId
  if (status) where.status = status

  const [consultations, total] = await Promise.all([
    prisma.consultation.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { visitDate: "desc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
        doctor: { select: { id: true, name: true } },
      },
    }),
    prisma.consultation.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: consultations,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  })
})

export const POST = withErrorHandling(async (req, _ctx, session) => {
  const body = await validateBody(req, consultationSchema)

  const lastConsultation = await prisma.consultation.findFirst({
    orderBy: { createdAt: "desc" },
    select: { consultationNumber: true },
  })
  const nextNumber = lastConsultation
    ? parseInt(lastConsultation.consultationNumber.replace("CON-", "")) + 1
    : 1
  const consultationNumber = `CON-${String(nextNumber).padStart(5, "0")}`

  const consultation = await prisma.consultation.create({
    data: {
      consultationNumber,
      patientId: body.patientId,
      doctorId: body.doctorId,
      clinicianId: session.user.id,
      appointmentId: body.appointmentId,
      visitDate: new Date(body.visitDate),
      visitTime: body.visitTime || "",
      chiefComplaint: body.chiefComplaint,
      vitalSigns: body.vitalSigns as any,
      physicalExamination: body.physicalExamination,
      diagnosis: body.diagnosis,
      icd11Codes: body.icd11Codes as any,
      treatmentPlan: body.treatmentPlan,
      notes: body.notes,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { name: true } },
    },
  })

  return NextResponse.json({ success: true, data: consultation }, { status: 201 })
})
