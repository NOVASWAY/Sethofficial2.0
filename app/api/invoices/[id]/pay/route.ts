import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/api-handler"
import { paymentSchema } from "@/lib/validation"
import { apiCache } from "@/lib/cache"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await validateBody(req, paymentSchema)

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { paymentAllocations: true },
    })

    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 })
    }

    await prisma.paymentAllocation.create({
      data: {
        invoiceId: params.id,
        paymentType: body.paymentMethod || "cash",
        amount: body.amount,
        paymentReference: body.reference,
        paymentDate: new Date(),
        notes: `Payment received by ${session.user.name}`,
      },
    })

    const totalPaid = invoice.paymentAllocations.reduce(
      (sum, pa) => sum + Number(pa.amount),
      0
    ) + body.amount

    const newStatus = totalPaid >= Number(invoice.totalAmount)
      ? "paid"
      : totalPaid > 0
      ? "partial"
      : "pending"

    await prisma.invoice.update({
      where: { id: params.id },
      data: { paymentStatus: newStatus },
    })

    const lastTransaction = await prisma.financialTransaction.findFirst({
      orderBy: { createdAt: "desc" },
      select: { transactionNumber: true },
    })
    const nextTxnNumber = lastTransaction
      ? parseInt(lastTransaction.transactionNumber.replace("TXN-", "")) + 1
      : 1

    await prisma.financialTransaction.create({
      data: {
        transactionNumber: `TXN-${String(nextTxnNumber).padStart(5, "0")}`,
        transactionDate: new Date(),
        transactionType: "income",
        category: "patient_payment",
        amount: body.amount,
        paymentMethod: body.paymentMethod || "cash",
        referenceId: params.id,
        referenceType: "invoice",
        description: `Payment for invoice ${invoice.invoiceNumber}`,
        createdById: session.user.id,
      },
    })

    apiCache.invalidate("^dashboard:metrics")

    return NextResponse.json({
      success: true,
      data: {
        totalPaid,
        remaining: Math.max(0, Number(invoice.totalAmount) - totalPaid),
        status: newStatus,
      },
    })
  } catch (error) {
    console.error("[Payment Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
