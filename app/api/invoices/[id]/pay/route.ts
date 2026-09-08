import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/api-handler"
import { paymentSchema } from "@/lib/validation"
import { apiCache } from "@/lib/cache"
import { writeAudit } from "@/lib/audit"
import { randomUUID } from "crypto"

async function nextTransactionNumber(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = await prisma.financialTransaction.findFirst({
      orderBy: { createdAt: "desc" },
      select: { transactionNumber: true },
    })
    const n = last ? parseInt(last.transactionNumber.replace("TXN-", "")) + 1 : 1
    const candidate = `TXN-${String(Number.isNaN(n) ? Date.now() % 100000 : n).padStart(5, "0")}`
    const exists = await prisma.financialTransaction.findUnique({
      where: { transactionNumber: candidate },
      select: { id: true },
    })
    if (!exists) return candidate
  }
  return `TXN-${Date.now().toString().slice(-8)}`
}

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

    const total = Number(invoice.totalAmount)
    const paidSoFar = invoice.paymentAllocations.reduce((sum, pa) => sum + Number(pa.amount), 0)
    const totalPaid = paidSoFar + body.amount
    const overpayment = Math.max(0, totalPaid - total)
    const newStatus = totalPaid >= total ? "paid" : totalPaid > 0 ? "partial" : "pending"
    const receiptNumber = `RCPT-${randomUUID().slice(0, 8).toUpperCase()}`
    const transactionNumber = await nextTransactionNumber()

    // Atomic: allocation + status + ledger succeed or fail together
    await prisma.$transaction([
      prisma.paymentAllocation.create({
        data: {
          invoiceId: params.id,
          paymentType: body.paymentMethod || "cash",
          amount: body.amount,
          paymentReference: body.reference || receiptNumber,
          paymentDate: new Date(),
          notes: `Receipt ${receiptNumber} received by ${session.user.name}${overpayment > 0 ? ` (overpayment KES ${overpayment})` : ""}`,
        },
      }),
      prisma.invoice.update({
        where: { id: params.id },
        data: { paymentStatus: newStatus },
      }),
      prisma.financialTransaction.create({
        data: {
          transactionNumber,
          transactionDate: new Date(),
          transactionType: "income",
          category: "patient_payment",
          amount: body.amount,
          paymentMethod: body.paymentMethod || "cash",
          referenceId: params.id,
          referenceType: "invoice",
          description: `Payment ${receiptNumber} for invoice ${invoice.invoiceNumber}`,
          createdById: session.user.id,
        },
      }),
    ])

    apiCache.invalidate("^dashboard:metrics")

    writeAudit({
      userId: session.user.id,
      action: "payment.received",
      resource: "invoice",
      resourceId: params.id,
      result: "success",
      details: { receiptNumber, amount: body.amount, method: body.paymentMethod || "cash", totalPaid, status: newStatus },
      req,
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        receiptNumber,
        totalPaid,
        remaining: Math.max(0, total - totalPaid),
        overpayment,
        status: newStatus,
      },
    })
  } catch (error) {
    console.error("[Payment Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
