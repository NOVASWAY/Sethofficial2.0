import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: { year: string; month: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const year = parseInt(params.year)
    const month = parseInt(params.month)

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0, 23, 59, 59)

    const claims = await prisma.shaClaim.findMany({
      where: {
        claimDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        patient: { select: { firstName: true, lastName: true, patientNumber: true } },
        invoice: { select: { invoiceNumber: true, totalAmount: true } },
      },
      orderBy: { claimDate: "desc" },
    })

    const totalClaims = claims.length
    const totalAmount = claims.reduce((sum, c) => sum + Number(c.totalAmount), 0)
    const approvedAmount = claims
      .filter((c) => c.status === "approved" || c.status === "paid")
      .reduce((sum, c) => sum + Number(c.approvedAmount || c.totalAmount), 0)
    const pendingClaims = claims.filter((c) => c.status === "pending").length
    const approvedClaims = claims.filter((c) => c.status === "approved").length
    const rejectedClaims = claims.filter((c) => c.status === "rejected").length
    const paidClaims = claims.filter((c) => c.status === "paid").length
    const paidAmount = claims
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + Number(c.approvedAmount || c.totalAmount), 0)

    return NextResponse.json({
      success: true,
      data: {
        year,
        month,
        totalClaims,
        totalAmount,
        approvedAmount,
        paidAmount,
        pendingClaims,
        approvedClaims,
        rejectedClaims,
        paidClaims,
        claims,
      },
    })
  } catch (error) {
    console.error("Error fetching monthly SHA summary:", error)
    return NextResponse.json({ error: "Failed to fetch monthly summary" }, { status: 500 })
  }
}
