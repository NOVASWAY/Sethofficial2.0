import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { checkoutRequestId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const transaction = await prisma.mpesaTransaction.findFirst({
      where: { checkoutRequestId: params.checkoutRequestId },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, paymentStatus: true } },
      },
    })

    if (!transaction) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: transaction })
  } catch (error) {
    console.error("[M-Pesa Status Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
