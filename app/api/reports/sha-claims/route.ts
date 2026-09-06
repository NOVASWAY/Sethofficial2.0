import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get("page") || "1")
  const perPage = parseInt(searchParams.get("per_page") || "20")
  const status = searchParams.get("status") || ""
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")
  const skip = (page - 1) * perPage

  const where: Record<string, unknown> = {}
  if (status && status !== "all") where.status = status
  if (dateFrom || dateTo) {
    where.claimDate = {}
    if (dateFrom) (where.claimDate as Record<string, unknown>).gte = new Date(dateFrom)
    if (dateTo) (where.claimDate as Record<string, unknown>).lte = new Date(dateTo)
  }

  const [claims, total] = await Promise.all([
    prisma.shaClaim.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: "desc" },
      include: {
        patient: { select: { firstName: true, lastName: true, patientNumber: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    }),
    prisma.shaClaim.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      claims,
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    },
  })
}
