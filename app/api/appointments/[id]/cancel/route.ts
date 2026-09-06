import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
  })

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
  }

  if (appointment.status === "cancelled") {
    return NextResponse.json({ error: "Appointment already cancelled" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))

  const updated = await prisma.appointment.update({
    where: { id: params.id },
    data: {
      status: "cancelled",
      notes: body.reason
        ? `${appointment.notes ? appointment.notes + "\n" : ""}Cancelled: ${body.reason}`
        : appointment.notes,
    },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      doctor: { select: { name: true } },
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
