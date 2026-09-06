import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")
  const patientId = searchParams.get("patientId")
  const pending = searchParams.get("pending") === "true"
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (patientId) where.patientId = patientId
  if (pending) where.status = { in: ["pending", "collected", "in_progress"] }

  const [orders, total] = await Promise.all([
    prisma.labTestOrder.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { orderedAt: "desc" },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
        orderingClinician: { select: { id: true, name: true } },
        results: true,
      },
    }),
    prisma.labTestOrder.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: orders,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  // Generate order number
  const lastOrder = await prisma.labTestOrder.findFirst({
    orderBy: { createdAt: "desc" },
    select: { orderNumber: true },
  })
  const nextNumber = lastOrder
    ? parseInt(lastOrder.orderNumber.replace("LAB-", "")) + 1
    : 1
  const orderNumber = `LAB-${String(nextNumber).padStart(5, "0")}`

  const order = await prisma.labTestOrder.create({
    data: {
      orderNumber,
      patientId: body.patientId,
      consultationId: body.consultationId,
      orderingClinicianId: session.user.id,
      testType: body.testType,
      testCode: body.testCode,
      testName: body.testName,
      priority: body.priority || "routine",
      clinicalIndication: body.clinicalIndication,
      sampleType: body.sampleType,
      notes: body.notes,
      createdById: session.user.id,
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
    },
  })

  return NextResponse.json({ success: true, data: order }, { status: 201 })
}
