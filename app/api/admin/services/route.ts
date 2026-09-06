import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const services = await prisma.service.findMany({
    orderBy: { serviceName: "asc" },
  })

  return NextResponse.json({ success: true, data: services })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()

  const service = await prisma.service.create({
    data: {
      serviceCode: body.serviceCode,
      serviceName: body.serviceName,
      category: body.category,
      unitPrice: body.unitPrice || 0,
      cashPrice: body.cashPrice || body.unitPrice || 0,
      shaPrice: body.shaPrice || 0,
      shaApproved: body.shaApproved || false,
      isActive: body.isActive ?? true,
    },
  })

  return NextResponse.json({ success: true, data: service }, { status: 201 })
}
