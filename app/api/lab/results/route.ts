import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get("orderId")
  const status = searchParams.get("status")
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || searchParams.get("limit") || "50")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (orderId) where.orderId = orderId
  if (status) where.status = status

  const [results, total] = await Promise.all([
    prisma.labTestResult.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
          },
        },
        verifiedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
    prisma.labTestResult.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      data: results,
      page,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  })
}
