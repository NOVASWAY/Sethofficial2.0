import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function getMpesaToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
  ).toString("base64")

  const baseUrl = process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke"

  const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  })

  const data = await res.json()
  return data.access_token
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { invoiceId, amount, phoneNumber } = body

  const token = await getMpesaToken()
  const now = new Date()
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, "0") +
    now.getDate().toString().padStart(2, "0") +
    now.getHours().toString().padStart(2, "0") +
    now.getMinutes().toString().padStart(2, "0") +
    now.getSeconds().toString().padStart(2, "0")

  const shortcode = process.env.MPESA_SHORTCODE || "174379"
  const passkey = process.env.MPESA_PASSKEY || ""
  const baseUrl = process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke"
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/callback`

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64")

  const mpesaRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(amount),
      PartyA: phoneNumber,
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: invoiceId || "SETMCLINIC",
      TransactionDesc: "Payment for medical services",
    }),
  })

  const mpesaData = await mpesaRes.json()

  if (mpesaData.ResponseCode === "0" && invoiceId) {
    await prisma.mpesaTransaction.create({
      data: {
        invoiceId,
        merchantRequestId: mpesaData.MerchantRequestID || "",
        checkoutRequestId: mpesaData.CheckoutRequestID,
        phoneNumber,
        amount: Math.round(amount),
        accountReference: invoiceId,
        transactionDesc: "Payment for medical services",
        status: "Pending",
      },
    })

    return NextResponse.json({
      success: true,
      checkoutRequestId: mpesaData.CheckoutRequestID,
      message: "Payment request sent to your phone",
    })
  }

  return NextResponse.json(
    { error: "Payment initiation failed", details: mpesaData },
    { status: 500 }
  )
}
