import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const doctorId = searchParams.get("doctorId")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (patientId) where.patientId = patientId
  if (doctorId) where.doctorId = doctorId
  if (status) where.status = status

  const [consultations, total] = await Promise.all([
    prisma.consultation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { visitDate: "desc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
        doctor: { select: { id: true, name: true } },
      },
    }),
    prisma.consultation.count({ where }),
  ])

  return NextResponse.json({ consultations, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Generate consultation number
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
      visitTime: body.visitTime,
      chiefComplaint: body.chiefComplaint,
      vitalSigns: body.vitalSigns,
      physicalExamination: body.physicalExamination,
      diagnosis: body.diagnosis,
      icd11Codes: body.icd11Codes,
      treatmentPlan: body.treatmentPlan,
      notes: body.notes,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { name: true } },
    },
  })

  return NextResponse.json(consultation, { status: 201 })
}
