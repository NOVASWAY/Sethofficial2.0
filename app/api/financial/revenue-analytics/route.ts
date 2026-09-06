import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  const dateFilter: Record<string, unknown> = {}
  if (startDate) dateFilter.gte = new Date(startDate)
  if (endDate) dateFilter.lte = new Date(endDate)

  const where = Object.keys(dateFilter).length > 0
    ? { transactionDate: dateFilter, transactionType: "income" }
    : { transactionType: "income" }

  const transactions = await prisma.financialTransaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
  })

  // Revenue by payment method
  const byMethod: Record<string, number> = {}
  transactions.forEach((t) => {
    const method = t.paymentMethod || "other"
    byMethod[method] = (byMethod[method] || 0) + Number(t.amount)
  })

  // Monthly revenue trend (last 12 months)
  const monthlyTrend: Record<string, number> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthlyTrend[key] = 0
  }
  transactions.forEach((t) => {
    const key = `${t.transactionDate.getFullYear()}-${String(t.transactionDate.getMonth() + 1).padStart(2, "0")}`
    if (monthlyTrend[key] !== undefined) {
      monthlyTrend[key] += Number(t.amount)
    }
  })

  // Revenue by category
  const byCategory: Record<string, number> = {}
  transactions.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount)
  })

  const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.amount), 0)

  return NextResponse.json({
    success: true,
    data: {
      totalRevenue,
      byMethod,
      byCategory,
      monthlyTrend: Object.entries(monthlyTrend).map(([month, revenue]) => ({ month, revenue })),
      transactionCount: transactions.length,
      avgTransaction: transactions.length > 0 ? totalRevenue / transactions.length : 0,
    },
  })
}
