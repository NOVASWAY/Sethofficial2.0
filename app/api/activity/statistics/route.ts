import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling } from "@/lib/api-handler"

export const GET = withErrorHandling(async (req) => {
  const { searchParams } = new URL(req.url)
  const days = parseInt(searchParams.get("days") || "7")
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [total, byAction] = await Promise.all([
    prisma.activityLog.count({ where: { timestamp: { gte: since } } }),
    prisma.activityLog.groupBy({
      by: ["action"],
      where: { timestamp: { gte: since } },
      _count: { action: true },
      orderBy: { _count: { action: "desc" } },
      take: 10,
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      total,
      days,
      byAction: byAction.map((r) => ({ action: r.action, count: r._count.action })),
    },
  })
})
