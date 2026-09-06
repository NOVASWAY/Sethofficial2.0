import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateFrom = searchParams.get("date_from")
  const dateTo = searchParams.get("date_to")

  const dateFilter: Record<string, unknown> = {}
  if (dateFrom) dateFilter.gte = new Date(dateFrom)
  if (dateTo) dateFilter.lte = new Date(dateTo)

  const where = Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}

  const transactions = await prisma.financialTransaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
  })

  // Compute summary
  const income = transactions
    .filter((t) => t.transactionType === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const expenses = transactions
    .filter((t) => t.transactionType === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Revenue by method
  const revenueByMethod: Record<string, number> = {}
  transactions
    .filter((t) => t.transactionType === "income")
    .forEach((t) => {
      const method = t.paymentMethod || "other"
      revenueByMethod[method] = (revenueByMethod[method] || 0) + Number(t.amount)
    })

  // Revenue by category
  const revenueByCategory: Record<string, number> = {}
  transactions
    .filter((t) => t.transactionType === "income")
    .forEach((t) => {
      revenueByCategory[t.category] = (revenueByCategory[t.category] || 0) + Number(t.amount)
    })

  // Monthly trend (last 12 months)
  const monthlyData: Record<string, { revenue: number; expenses: number }> = {}
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    monthlyData[key] = { revenue: 0, expenses: 0 }
  }
  transactions.forEach((t) => {
    const key = `${t.transactionDate.getFullYear()}-${String(t.transactionDate.getMonth() + 1).padStart(2, "0")}`
    if (monthlyData[key]) {
      if (t.transactionType === "income") monthlyData[key].revenue += Number(t.amount)
      else monthlyData[key].expenses += Number(t.amount)
    }
  })

  return NextResponse.json({
    success: true,
    data: {
      totalRevenue: income,
      totalExpenses: expenses,
      netProfit: income - expenses,
      profitMargin: income > 0 ? ((income - expenses) / income) * 100 : 0,
      revenueByMethod,
      revenueByCategory,
      monthlyData: Object.entries(monthlyData).map(([month, data]) => ({
        month,
        ...data,
        profit: data.revenue - data.expenses,
      })),
      transactionCount: transactions.length,
    },
  })
}
