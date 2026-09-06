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
    ? { transactionDate: dateFilter, transactionType: "expense" }
    : { transactionType: "expense" }

  const transactions = await prisma.financialTransaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
  })

  // Expenses by category
  const byCategory: Record<string, number> = {}
  transactions.forEach((t) => {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount)
  })

  // Monthly expense trend
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

  const totalExpenses = transactions.reduce((sum, t) => sum + Number(t.amount), 0)

  return NextResponse.json({
    success: true,
    data: {
      totalExpenses,
      byCategory,
      monthlyTrend: Object.entries(monthlyTrend).map(([month, expenses]) => ({ month, expenses })),
      transactionCount: transactions.length,
      avgExpense: transactions.length > 0 ? totalExpenses / transactions.length : 0,
    },
  })
}
