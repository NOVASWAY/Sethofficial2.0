import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling } from "@/lib/api-handler"

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (req) => {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100)
  const days = parseInt(searchParams.get("days") || "7")

  const logs = await prisma.activityLog.findMany({
    where: { timestamp: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: { user: { select: { id: true, name: true, role: true } } },
  })

  return NextResponse.json({ success: true, data: logs })
})
