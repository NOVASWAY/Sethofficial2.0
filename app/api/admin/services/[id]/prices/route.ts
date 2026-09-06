import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()

  const service = await prisma.service.update({
    where: { id: params.id },
    data: {
      ...(body.unitPrice !== undefined && { unitPrice: body.unitPrice }),
      ...(body.cashPrice !== undefined && { cashPrice: body.cashPrice }),
      ...(body.shaPrice !== undefined && { shaPrice: body.shaPrice }),
      ...(body.shaApproved !== undefined && { shaApproved: body.shaApproved }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  })

  return NextResponse.json({ success: true, data: service })
}
