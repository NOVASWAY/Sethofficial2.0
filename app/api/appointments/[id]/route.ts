import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, patientNumber: true } },
      doctor: { select: { id: true, name: true } },
    },
  })

  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ success: true, data: appointment })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const appointment = await prisma.appointment.update({
    where: { id: params.id },
    data: {
      ...(body.date && { date: new Date(body.date) }),
      ...(body.time && { time: body.time }),
      ...(body.duration && { duration: body.duration }),
      ...(body.status && { status: body.status }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.doctorId && { doctorId: body.doctorId }),
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { name: true } },
    },
  })

  return NextResponse.json({ success: true, data: appointment })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.appointment.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true, data: { deleted: true } })
}
