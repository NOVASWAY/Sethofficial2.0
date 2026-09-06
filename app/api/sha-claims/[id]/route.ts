import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const claim = await prisma.shaClaim.findUnique({
      where: { id: params.id },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientNumber: true, phone: true, insuranceNumber: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            paymentStatus: true,
            invoiceItems: true,
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
    })

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: claim })
  } catch (error) {
    console.error("Error fetching SHA claim:", error)
    return NextResponse.json({ error: "Failed to fetch SHA claim" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()

    const claim = await prisma.shaClaim.update({
      where: { id: params.id },
      data: {
        status: body.status,
        approvedAmount: body.approvedAmount,
        rejectionReason: body.rejectionReason,
        submissionDate: body.submissionDate ? new Date(body.submissionDate) : undefined,
        approvalDate: body.approvalDate ? new Date(body.approvalDate) : undefined,
        paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined,
        notes: body.notes,
      },
      include: {
        patient: { select: { firstName: true, lastName: true, patientNumber: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    })

    return NextResponse.json({ success: true, data: claim })
  } catch (error) {
    console.error("Error updating SHA claim:", error)
    return NextResponse.json({ error: "Failed to update SHA claim" }, { status: 500 })
  }
}
