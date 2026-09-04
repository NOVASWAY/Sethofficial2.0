import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const patientId = searchParams.get("patientId")
  const consultationId = searchParams.get("consultationId")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (patientId) where.patientId = patientId
  if (consultationId) where.consultationId = consultationId
  if (status) where.status = status

  const [prescriptions, total] = await Promise.all([
    prisma.prescription.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
        doctor: { select: { id: true, name: true } },
        items: true,
      },
    }),
    prisma.prescription.count({ where }),
  ])

  return NextResponse.json({ prescriptions, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Generate prescription number
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
      doctorId: body.doctorId,
      consultationId: body.consultationId,
      clinicianId: body.clinicianId,
      medicationId: body.medicineId,
      medicationName: body.medicationName || body.medicineName || "Unknown",
      dosage: body.dosage || "",
      frequency: body.frequency || "",
      durationDays: body.durationDays || 0,
      quantity: body.quantity || 0,
      instructions: body.instructions,
      medicines: body.items ? JSON.stringify(body.items) : "[]",
      items: body.items
        ? {
            create: body.items.map((item: Record<string, unknown>) => ({
              medicationId: item.medicineId || item.medicationId,
              quantity: item.quantity,
              dosage: item.dosage,
              frequency: item.frequency,
              durationDays: item.durationDays || item.duration,
              instructions: item.instructions,
            })),
          }
        : undefined,
    },
    include: { items: true },
  })

  return NextResponse.json(prescription, { status: 201 })
}
