import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const stkCallback = body.Body?.stkCallback

  if (!stkCallback) {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" })
  }

  const checkoutRequestId = stkCallback.CheckoutRequestID
  const resultCode = stkCallback.ResultCode
  const resultDesc = stkCallback.ResultDesc

  // Always log the raw callback first (audit trail, even on failure)
  await prisma.mpesaCallbackLog.create({
    data: {
      checkoutRequestId: checkoutRequestId || "",
      callbackData: body,
      processingStatus: resultCode === 0 ? "Success" : "Failed",
      errorMessage: resultCode !== 0 ? resultDesc : null,
    },
  })

  if (resultCode === 0) {
    const metadata = stkCallback.CallbackMetadata?.Item || []
    const mpesaReceipt = metadata.find(
      (item: Record<string, string>) => item.Name === "MpesaReceiptNumber"
    )?.Value

    const transaction = await prisma.mpesaTransaction.findFirst({
      where: { checkoutRequestId },
    })

    if (!transaction) {
      console.error("[M-Pesa Callback] Unknown checkoutRequestId:", checkoutRequestId)
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" })
    }

    // Idempotency: Safaricom retries must not double-credit
    if (transaction.status === "Success") {
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" })
    }
    const existingAllocation = await prisma.paymentAllocation.findFirst({
      where: { paymentReference: checkoutRequestId },
    })
    if (existingAllocation) {
      await prisma.mpesaTransaction.updateMany({
        where: { checkoutRequestId },
        data: { status: "Success", resultCode, resultDesc, mpesaReceiptNumber: mpesaReceipt || null },
      })
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" })
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: transaction.invoiceId },
      include: { paymentAllocations: true },
    })
    if (!invoice) {
      console.error("[M-Pesa Callback] Invoice not found:", transaction.invoiceId)
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" })
    }

    const totalPaid = invoice.paymentAllocations.reduce(
      (sum, pa) => sum + Number(pa.amount),
      0
    ) + Number(transaction.amount)
    const newStatus = totalPaid >= Number(invoice.totalAmount) ? "paid" : "partial"

    const lastTxn = await prisma.financialTransaction.findFirst({
      orderBy: { createdAt: "desc" },
      select: { transactionNumber: true },
    })
    const nextTxnNumber = lastTxn
      ? parseInt(lastTxn.transactionNumber.replace("TXN-", "")) + 1
      : 1
    const transactionNumber = `TXN-${String(nextTxnNumber).padStart(5, "0")}`

    // Atomic: status + allocation + invoice + ledger succeed or fail together
    await prisma.$transaction([
      prisma.mpesaTransaction.updateMany({
        where: { checkoutRequestId },
        data: {
          status: "Success",
          resultCode,
          resultDesc,
          mpesaReceiptNumber: mpesaReceipt || null,
          transactionDate: new Date().toISOString(),
        },
      }),
      prisma.paymentAllocation.create({
        data: {
          invoiceId: transaction.invoiceId,
          paymentType: "mpesa",
          amount: transaction.amount,
          paymentReference: checkoutRequestId,
          paymentDate: new Date(),
          notes: mpesaReceipt ? `M-Pesa receipt ${mpesaReceipt}` : undefined,
        },
      }),
      prisma.invoice.update({
        where: { id: transaction.invoiceId },
        data: { paymentStatus: newStatus },
      }),
      prisma.financialTransaction.create({
        data: {
          transactionNumber,
          transactionDate: new Date(),
          transactionType: "income",
          category: "patient_payment",
          amount: transaction.amount,
          paymentMethod: "mpesa",
          referenceId: transaction.invoiceId,
          referenceType: "invoice",
          description: `M-Pesa payment for invoice ${invoice.invoiceNumber}${mpesaReceipt ? ` (${mpesaReceipt})` : ""}`,
          createdById: invoice.createdById,
        },
      }),
    ])
  } else {
    await prisma.mpesaTransaction.updateMany({
      where: { checkoutRequestId },
      data: { status: "Failed", resultCode, resultDesc },
    })
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" })
}
