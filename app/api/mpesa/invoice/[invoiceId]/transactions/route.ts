import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest, { params }: { params: { invoiceId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const transactions = await prisma.mpesaTransaction.findMany({
      where: { invoiceId: params.invoiceId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: transactions })
  } catch (error) {
    console.error("[M-Pesa Invoice Txns Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
