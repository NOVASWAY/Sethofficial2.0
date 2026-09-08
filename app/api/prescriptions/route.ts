import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling, validateBody } from "@/lib/api-handler"
import { prescriptionSchema } from "@/lib/validation"

export const GET = withErrorHandling(async (req) => {
  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const consultationId = searchParams.get("consultationId")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (patientId) where.patientId = patientId
  if (consultationId) where.consultationId = consultationId
  if (status) where.status = status

  const [prescriptions, total] = await Promise.all([
    prisma.prescription.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
        doctor: { select: { id: true, name: true } },
        items: true,
      },
    }),
    prisma.prescription.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: prescriptions,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  })
})

export const POST = withErrorHandling(async (req, _ctx, session) => {
  const body = await validateBody(req, prescriptionSchema)

  const last = await prisma.prescription.findFirst({
    orderBy: { createdAt: "desc" },
    select: { prescriptionNumber: true },
  })
  const nextNumber = last
    ? parseInt(last.prescriptionNumber.replace("RX-", "")) + 1
    : 1
  const prescriptionNumber = `RX-${String(nextNumber).padStart(5, "0")}`

  const prescription = await prisma.prescription.create({
    data: {
      prescriptionNumber,
      patientId: body.patientId,
      doctorId: body.doctorId || session.user.id,
      consultationId: body.consultationId || undefined,
      clinicianId: body.clinicianId || undefined,
      medicationId: body.medicineId || undefined,
      medicationName: body.medicationName || "Unknown",
      dosage: body.dosage || "",
      frequency: body.frequency || "",
      durationDays: body.durationDays || 0,
      quantity: body.quantity || 0,
      instructions: body.instructions,
      medicines: body.items ? JSON.stringify(body.items) : "[]",
      items: body.items
        ? {
            create: body.items.map((item: any) => ({
              medicationId: String(item.medicineId || item.medicationId),
              quantity: Number(item.quantity),
              dosage: item.dosage || "",
              frequency: item.frequency || "",
              durationDays: Number(item.durationDays || item.duration || 0),
              instructions: item.instructions || "",
            })),
          }
        : undefined,
    },
    include: { items: true },
  })

  return NextResponse.json({ success: true, data: prescription }, { status: 201 })
})
