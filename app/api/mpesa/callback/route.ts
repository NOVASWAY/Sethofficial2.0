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

  // Log the callback
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

    // Update mpesa transaction
    await prisma.mpesaTransaction.updateMany({
      where: { checkoutRequestId },
      data: {
        status: "Success",
        resultCode: resultCode,
        resultDesc: resultDesc,
        mpesaReceiptNumber: mpesaReceipt || null,
        transactionDate: new Date().toISOString(),
      },
    })

    // Get the transaction to find the invoice
    const transaction = await prisma.mpesaTransaction.findFirst({
      where: { checkoutRequestId },
    })

    if (transaction) {
      // Update invoice payment status via allocation
      const invoice = await prisma.invoice.findUnique({
        where: { id: transaction.invoiceId },
        include: { paymentAllocations: true },
      })

      if (invoice) {
        const totalPaid = invoice.paymentAllocations.reduce(
          (sum, pa) => sum + Number(pa.amount),
          0
        ) + Number(transaction.amount)

        await prisma.invoice.update({
          where: { id: transaction.invoiceId },
          data: {
            paymentStatus:
              totalPaid >= Number(invoice.totalAmount) ? "paid" : "partial",
          },
        })

        // Create payment allocation
        await prisma.paymentAllocation.create({
          data: {
            invoiceId: transaction.invoiceId,
            paymentType: "mpesa",
            amount: transaction.amount,
            paymentReference: transaction.checkoutRequestId,
            paymentDate: new Date(),
          },
        })
      }
    }
  } else {
    // Transaction failed
    await prisma.mpesaTransaction.updateMany({
      where: { checkoutRequestId },
      data: {
        status: "Failed",
        resultCode: resultCode,
        resultDesc: resultDesc,
      },
    })
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: "Success" })
}
