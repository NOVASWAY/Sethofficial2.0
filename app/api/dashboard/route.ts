import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  const [
    totalPatients,
    todayAppointments,
    pendingAppointments,
    todayConsultations,
    pendingLabOrders,
    lowStockMedicines,
    pendingInvoices,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    recentPatients,
    recentNotifications,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count({
      where: {
        date: { gte: today, lt: tomorrow },
        status: { notIn: ["cancelled", "no_show"] },
      },
    }),
    prisma.appointment.count({
      where: { status: "scheduled" },
    }),
    prisma.consultation.count({
      where: { visitDate: { gte: today, lt: tomorrow } },
    }),
    prisma.labTestOrder.count({
      where: { status: { in: ["pending", "collected", "in_progress"] } },
    }),
    prisma.medicine.count({
      where: { currentStock: { lte: 10 } },
    }),
    prisma.invoice.count({
      where: { paymentStatus: { in: ["pending", "partial"] } },
    }),
    prisma.financialTransaction.aggregate({
      where: {
        transactionDate: { gte: today },
        category: "patient_payment",
      },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: {
        transactionDate: { gte: weekStart },
        category: "patient_payment",
      },
      _sum: { amount: true },
    }),
    prisma.financialTransaction.aggregate({
      where: {
        transactionDate: { gte: monthStart },
        category: "patient_payment",
      },
      _sum: { amount: true },
    }),
    prisma.patient.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        patientNumber: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
    }),
    prisma.notification.findMany({
      where: { recipientId: session.user.id, isRead: false },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ])

  return NextResponse.json({
    totalPatients,
    todayAppointments,
    pendingAppointments,
    todayConsultations,
    pendingLabOrders,
    lowStockMedicines,
    pendingInvoices,
    todayRevenue: todayRevenue._sum.amount || 0,
    weekRevenue: weekRevenue._sum.amount || 0,
    monthRevenue: monthRevenue._sum.amount || 0,
    recentPatients,
    recentNotifications,
  })
}
