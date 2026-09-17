import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withErrorHandling } from "@/lib/api-handler"

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (req, ctx) => {
  const userId = ctx.params.userId
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
  const action = searchParams.get("action")

  const where: Record<string, unknown> = { userId }
  if (action) where.action = action

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: limit,
  })

  return NextResponse.json({ success: true, data: logs })
})
