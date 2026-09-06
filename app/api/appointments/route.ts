import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  const doctorId = searchParams.get("doctorId")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (date) where.date = new Date(date)
  if (doctorId) where.doctorId = doctorId
  if (status) where.status = status

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take: perPage,
      orderBy: [{ date: "asc" }, { time: "asc" }],
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true, patientNumber: true } },
        doctor: { select: { id: true, name: true } },
      },
    }),
    prisma.appointment.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: appointments,
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

  // Check for conflicts
  const conflicting = await prisma.appointment.findFirst({
    where: {
      doctorId: body.doctorId,
      date: new Date(body.date),
      time: body.time,
      status: { notIn: ["cancelled"] },
    },
  })

  if (conflicting) {
    return NextResponse.json({ error: "Time slot already booked" }, { status: 409 })
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId: body.patientId,
      doctorId: body.doctorId,
      date: new Date(body.date),
      time: body.time,
      duration: body.duration || 30,
      notes: body.notes,
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { name: true } },
    },
  })

  return NextResponse.json({ success: true, data: appointment }, { status: 201 })
}
