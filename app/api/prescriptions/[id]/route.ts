import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prescription = await prisma.prescription.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
      doctor: { select: { id: true, name: true } },
      items: true,
    },
  })

  if (!prescription) {
    return NextResponse.json({ error: "Prescription not found" }, { status: 404 })
  }

  return NextResponse.json(prescription)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const prescription = await prisma.prescription.update({
    where: { id: params.id },
    data: {
      status: body.status,
      instructions: body.instructions,
      dispensedById: body.status === "dispensed" ? session.user.id : undefined,
      dispensedAt: body.status === "dispensed" ? new Date() : undefined,
    },
    include: { items: true },
  })

  return NextResponse.json(prescription)
}
