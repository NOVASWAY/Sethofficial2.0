import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { serviceIds, insuranceType } = body

  if (!serviceIds || !Array.isArray(serviceIds)) {
    return NextResponse.json({ error: "serviceIds array required" }, { status: 400 })
  }

  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
  })

  const pricing = services.map(service => ({
    id: service.id,
    serviceCode: service.serviceCode,
    serviceName: service.serviceName,
    category: service.category,
    unitPrice: Number(service.unitPrice),
    cashPrice: Number(service.cashPrice),
    shaPrice: Number(service.shaPrice),
    applicablePrice: insuranceType === "sha"
      ? Number(service.shaPrice)
      : insuranceType === "nhif"
      ? Number(service.unitPrice)
      : Number(service.cashPrice),
  }))

  const total = pricing.reduce((sum, p) => sum + p.applicablePrice, 0)

  return NextResponse.json({ success: true, data: { pricing, total } })
}
