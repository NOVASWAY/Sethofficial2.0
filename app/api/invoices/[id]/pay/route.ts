import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { amount, paymentMethod, reference } = body

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { paymentAllocations: true },
  })

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  // Create payment allocation
  await prisma.paymentAllocation.create({
    data: {
      invoiceId: params.id,
      paymentType: paymentMethod || "cash",
      amount: amount,
      paymentReference: reference,
      paymentDate: new Date(),
      notes: `Payment received by ${session.user.name}`,
    },
  })

  // Calculate total paid
  const totalPaid = invoice.paymentAllocations.reduce(
    (sum, pa) => sum + Number(pa.amount),
    0
  ) + Number(amount)

  // Update invoice status
  const newStatus = totalPaid >= Number(invoice.totalAmount)
    ? "paid"
    : totalPaid > 0
    ? "partial"
    : "pending"

  await prisma.invoice.update({
    where: { id: params.id },
    data: { paymentStatus: newStatus },
  })

  // Create financial transaction record
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
      amount: amount,
      paymentMethod: paymentMethod || "cash",
      referenceId: params.id,
      referenceType: "invoice",
      description: `Payment for invoice ${invoice.invoiceNumber}`,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      totalPaid,
      remaining: Math.max(0, Number(invoice.totalAmount) - totalPaid),
      status: newStatus,
    },
  })
}
