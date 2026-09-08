import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/api-handler"
import { appointmentUpdateSchema } from "@/lib/validation"
import { apiCache } from "@/lib/cache"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true, patientNumber: true } },
        doctor: { select: { id: true, name: true } },
      },
    })

    if (!appointment) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
    return NextResponse.json({ success: true, data: appointment })
  } catch (error) {
    console.error("[Appointment GET Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await validateBody(req, appointmentUpdateSchema)

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

    apiCache.invalidate("^dashboard:metrics")

    return NextResponse.json({ success: true, data: appointment })
  } catch (error) {
    console.error("[Appointment PUT Error]", error)
    if (error instanceof Error && error.message.includes("Record to update not found")) {
      return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 })
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    await prisma.appointment.delete({ where: { id: params.id } })
    apiCache.invalidate("^dashboard:metrics")
    return NextResponse.json({ success: true, data: { deleted: true } })
  } catch (error) {
    console.error("[Appointment DELETE Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
