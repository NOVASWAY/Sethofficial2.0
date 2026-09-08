import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiCache, CACHE_TTL } from "@/lib/cache"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const cacheKey = `lab:pending:${limit}`

    const cached = apiCache.get(cacheKey)
    if (cached) return NextResponse.json({ success: true, data: cached })

    const orders = await prisma.labTestOrder.findMany({
      where: { status: { in: ["pending", "collected", "in_progress"] } },
      orderBy: [{ priority: "asc" }, { orderedAt: "asc" }],
      take: limit,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true } },
        orderingClinician: { select: { id: true, name: true } },
      },
    })

    apiCache.set(cacheKey, orders, CACHE_TTL.SHORT)

    return NextResponse.json({ success: true, data: orders })
  } catch (error) {
    console.error("Error fetching pending lab orders:", error)
    return NextResponse.json({ success: true, data: [] })
  }
}
