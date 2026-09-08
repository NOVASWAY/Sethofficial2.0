import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiCache, CACHE_TTL } from "@/lib/cache"

export async function GET(req: NextRequest, { params }: { params: { role: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const role = params.role
  const cacheKey = `dashboard:metrics:${role}`
  const cached = apiCache.get(cacheKey)
  if (cached) return NextResponse.json({ success: true, data: cached })

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

  const pendingLabOrders = await prisma.labTestOrder.count({
    where: { status: { in: ["pending", "collected"] } },
  })

  const lowStockMedicines = await prisma.medicine.count({
    where: { currentStock: { lte: 10 } },
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
    lowStockMedicines,
  }

  if (role === "admin") {
    const totalRevenue = await prisma.invoice.aggregate({ _sum: { totalAmount: true } })
    const pendingRevenue = await prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: { in: ["pending", "partial"] } },
    })

    const activeUsers = await prisma.user.count({ where: { isActive: true } })

    metrics.totalRevenue = totalRevenue._sum.totalAmount || 0
    metrics.pendingRevenue = pendingRevenue._sum.totalAmount || 0
    metrics.activeUsers = activeUsers
  }

  apiCache.set(cacheKey, metrics, CACHE_TTL.MEDIUM)

  return NextResponse.json({ success: true, data: metrics })
}
