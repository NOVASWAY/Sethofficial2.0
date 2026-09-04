import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") || "dashboard"
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  const dateFilter: Record<string, Date> = {}
  if (startDate) dateFilter.gte = new Date(startDate)
  if (endDate) dateFilter.lte = new Date(endDate)

  switch (type) {
    case "dashboard": {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const [patients, appointments, consultations, revenue] = await Promise.all([
        prisma.patient.count(),
        prisma.appointment.count({ where: { date: { gte: today, lt: tomorrow } } }),
        prisma.consultation.count({ where: { visitDate: { gte: today, lt: tomorrow } } }),
        prisma.financialTransaction.aggregate({
          where: { transactionDate: dateFilter, category: "patient_payment" },
          _sum: { amount: true },
          _count: true,
        }),
      ])

      return NextResponse.json({
        type: "dashboard",
        data: { patients, appointments, consultations, revenue: revenue._sum.amount || 0, transactionCount: revenue._count },
      })
    }

    case "financial": {
      const transactions = await prisma.financialTransaction.groupBy({
        by: ["category", "transactionType"],
        where: { transactionDate: dateFilter },
        _sum: { amount: true },
        _count: true,
      })

      const totalIncome = await prisma.financialTransaction.aggregate({
        where: { transactionDate: dateFilter, transactionType: "income" },
        _sum: { amount: true },
      })

      const totalExpenses = await prisma.financialTransaction.aggregate({
        where: { transactionDate: dateFilter, transactionType: "expense" },
        _sum: { amount: true },
      })

      return NextResponse.json({
        type: "financial",
        data: {
          transactions,
          totalIncome: totalIncome._sum.amount || 0,
          totalExpenses: totalExpenses._sum.amount || 0,
          profit: Number(totalIncome._sum.amount || 0) - Number(totalExpenses._sum.amount || 0),
        },
      })
    }

    default:
      return NextResponse.json({ error: "Unknown report type" }, { status: 400 })
  }
}
