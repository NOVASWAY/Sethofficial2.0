import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { date: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const date = new Date(params.date)
  const startOfDay = new Date(date.setHours(0, 0, 0, 0))
  const endOfDay = new Date(date.setHours(23, 59, 59, 999))

  const appointments = await prisma.appointment.findMany({
    where: {
      date: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["cancelled"] },
    },
    orderBy: { time: "asc" },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, patientNumber: true } },
      doctor: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ success: true, data: appointments })
}
