import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

  // This month transactions
  const thisMonthTransactions = await prisma.financialTransaction.findMany({
    where: { transactionDate: { gte: thisMonthStart } },
  })

  // Last month transactions
  const lastMonthTransactions = await prisma.financialTransaction.findMany({
    where: { transactionDate: { gte: lastMonthStart, lte: lastMonthEnd } },
  })

  // This month metrics
  const thisMonthRevenue = thisMonthTransactions
    .filter((t) => t.transactionType === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const thisMonthExpenses = thisMonthTransactions
    .filter((t) => t.transactionType === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Last month metrics
  const lastMonthRevenue = lastMonthTransactions
    .filter((t) => t.transactionType === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const lastMonthExpenses = lastMonthTransactions
    .filter((t) => t.transactionType === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Calculate growth rates
  const revenueGrowth = lastMonthRevenue > 0
    ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0
  const expenseGrowth = lastMonthExpenses > 0
    ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
    : 0

  // Patient count this month
  const patientCount = await prisma.patient.count()
  const newPatientsThisMonth = await prisma.patient.count({
    where: { createdAt: { gte: thisMonthStart } },
  })

  // Invoice metrics
  const totalInvoices = await prisma.invoice.count()
  const paidInvoices = await prisma.invoice.count({ where: { paymentStatus: "paid" } })
  const pendingInvoices = await prisma.invoice.count({ where: { paymentStatus: "pending" } })

  // Average transaction value
  const incomeTransactions = thisMonthTransactions.filter((t) => t.transactionType === "income")
  const avgTransaction = incomeTransactions.length > 0
    ? thisMonthRevenue / incomeTransactions.length
    : 0

  return NextResponse.json({
    success: true,
    data: {
      revenue: {
        thisMonth: thisMonthRevenue,
        lastMonth: lastMonthRevenue,
        growth: revenueGrowth,
      },
      expenses: {
        thisMonth: thisMonthExpenses,
        lastMonth: lastMonthExpenses,
        growth: expenseGrowth,
      },
      profit: {
        thisMonth: thisMonthRevenue - thisMonthExpenses,
        lastMonth: lastMonthRevenue - lastMonthExpenses,
        margin: thisMonthRevenue > 0
          ? ((thisMonthRevenue - thisMonthExpenses) / thisMonthRevenue) * 100
          : 0,
      },
      patients: {
        total: patientCount,
        newThisMonth: newPatientsThisMonth,
      },
      invoices: {
        total: totalInvoices,
        paid: paidInvoices,
        pending: pendingInvoices,
        collectionRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0,
      },
      avgTransaction,
    },
  })
}
