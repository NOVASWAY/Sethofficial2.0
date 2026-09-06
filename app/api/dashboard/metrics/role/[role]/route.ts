import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { role: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = params.role

  const totalPatients = await prisma.patient.count()
  const totalAppointments = await prisma.appointment.count()
  const totalConsultations = await prisma.consultation.count()
  const totalPrescriptions = await prisma.prescription.count()
  const totalInvoices = await prisma.invoice.count()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayAppointments = await prisma.appointment.count({
    where: { date: { gte: today, lt: tomorrow } },
  })

  const pendingPrescriptions = await prisma.prescription.count({
    where: { status: "active" },
  })

  const pendingLabOrders = await prisma.prescription.count({
    where: { status: "active" },
  })

  const metrics: Record<string, unknown> = {
    totalPatients,
    totalAppointments,
    totalConsultations,
    totalPrescriptions,
    totalInvoices,
    todayAppointments,
    pendingPrescriptions,
    pendingLabOrders,
  }

  if (role === "admin") {
    const totalRevenue = await prisma.invoice.aggregate({ _sum: { totalAmount: true } })
    const pendingRevenue = await prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: { in: ["pending", "partial"] } },
    })
    metrics.totalRevenue = totalRevenue._sum.totalAmount || 0
    metrics.pendingRevenue = pendingRevenue._sum.totalAmount || 0
  }

  return NextResponse.json({ success: true, data: metrics })
}
