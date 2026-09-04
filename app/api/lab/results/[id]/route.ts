import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await prisma.labTestResult.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
          orderingClinician: { select: { id: true, name: true } },
        },
      },
      verifiedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  })

  if (!result) {
    return NextResponse.json({ error: "Result not found" }, { status: 404 })
  }

  return NextResponse.json(result)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const result = await prisma.labTestResult.update({
    where: { id: params.id },
    data: {
      testValues: body.testValues,
      status: body.status,
      verifiedById: body.status === "verified" ? session.user.id : undefined,
      verifiedAt: body.status === "verified" ? new Date() : undefined,
      reviewedById: body.status === "reviewed" ? session.user.id : undefined,
      reviewedAt: body.status === "reviewed" ? new Date() : undefined,
      notes: body.notes,
    },
    include: {
      order: { include: { patient: { select: { firstName: true, lastName: true } } } },
    },
  })

  return NextResponse.json(result)
}
