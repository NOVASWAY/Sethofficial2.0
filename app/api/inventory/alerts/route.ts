import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const lowStock = await prisma.medicine.findMany({
    where: { currentStock: { lte: 10 } },
    orderBy: { currentStock: "asc" },
  })

  const threeMonthsFromNow = new Date()
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)

  const expiring = await prisma.medicine.findMany({
    where: {
      expiryDate: { lte: threeMonthsFromNow, gte: new Date() },
    },
    orderBy: { expiryDate: "asc" },
  })

  const outOfStock = await prisma.medicine.findMany({
    where: { currentStock: 0 },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({
    success: true,
    data: {
      lowStock,
      expiring,
      outOfStock,
      summary: {
        lowStockCount: lowStock.length,
        expiringCount: expiring.length,
        outOfStockCount: outOfStock.length,
      },
    },
  })
}
