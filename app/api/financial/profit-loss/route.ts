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

  const transactions = await prisma.financialTransaction.findMany({
    where,
    orderBy: { transactionDate: "desc" },
  })

  const income = transactions
    .filter((t) => t.transactionType === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const expenses = transactions
    .filter((t) => t.transactionType === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Income by category
  const incomeByCategory: Record<string, number> = {}
  transactions
    .filter((t) => t.transactionType === "income")
    .forEach((t) => {
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + Number(t.amount)
    })

  // Expenses by category
  const expensesByCategory: Record<string, number> = {}
  transactions
    .filter((t) => t.transactionType === "expense")
    .forEach((t) => {
      expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + Number(t.amount)
    })

  // Monthly breakdown
  const monthlyBreakdown: Record<string, { income: number; expenses: number }> = {}
  transactions.forEach((t) => {
    const key = `${t.transactionDate.getFullYear()}-${String(t.transactionDate.getMonth() + 1).padStart(2, "0")}`
    if (!monthlyBreakdown[key]) monthlyBreakdown[key] = { income: 0, expenses: 0 }
    if (t.transactionType === "income") monthlyBreakdown[key].income += Number(t.amount)
    else monthlyBreakdown[key].expenses += Number(t.amount)
  })

  return NextResponse.json({
    success: true,
    data: {
      period: { startDate: startDate || "all", endDate: endDate || "all" },
      revenue: { total: income, byCategory: incomeByCategory },
      expenses: { total: expenses, byCategory: expensesByCategory },
      netProfit: income - expenses,
      profitMargin: income > 0 ? ((income - expenses) / income) * 100 : 0,
      monthlyBreakdown: Object.entries(monthlyBreakdown).map(([month, data]) => ({
        month,
        ...data,
        profit: data.income - data.expenses,
      })),
    },
  })
}
