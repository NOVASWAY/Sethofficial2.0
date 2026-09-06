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

  const where = Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}

  const transactions = await prisma.financialTransaction.findMany({ where })

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

  // Expenses by category
  const expensesByCategory: Record<string, number> = {}
  transactions
    .filter((t) => t.transactionType === "expense")
    .forEach((t) => {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + Number(t.amount)
    })

  // Transaction counts
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTransactions = transactions.filter(
    (t) => t.transactionDate >= today
  )
  const todayRevenue = todayTransactions
    .filter((t) => t.transactionType === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return NextResponse.json({
    success: true,
    data: {
      totalRevenue: income,
      totalExpenses: expenses,
      netProfit: income - expenses,
      profitMargin: income > 0 ? ((income - expenses) / income) * 100 : 0,
      revenueByMethod,
      expensesByCategory,
      todayRevenue,
      transactionCount: transactions.length,
    },
  })
}
