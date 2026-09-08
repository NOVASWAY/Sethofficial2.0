import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling } from "@/lib/api-handler"

export const GET = withErrorHandling(async (req) => {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")

  const where: Record<string, unknown> = { isActive: true }
  if (category) where.category = category

  const services = await prisma.service.findMany({
    where,
    orderBy: { serviceName: "asc" },
  })

  return NextResponse.json({ success: true, data: { services } })
})

export const POST = withErrorHandling(async (req, _ctx, session) => {
  if (session.user.role !== "admin") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

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
    },
  })

  return NextResponse.json({ success: true, data: service }, { status: 201 })
})
