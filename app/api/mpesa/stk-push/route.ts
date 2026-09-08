import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { validateBody } from "@/lib/api-handler"
import { mpesaStkSchema, normalizeKePhone } from "@/lib/validation"
import { requireMfaForSensitiveAction } from "@/lib/mfa-gate"

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
  if (!data.access_token) {
    throw new Error("M-Pesa auth failed: no access token returned")
  }
  return data.access_token
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    // Loud-fail on missing credentials — never fall back to sandbox defaults silently
    const consumerKey = process.env.MPESA_CONSUMER_KEY
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET
    const shortcode = process.env.MPESA_SHORTCODE
    const passkey = process.env.MPESA_PASSKEY
    if (!consumerKey || !consumerSecret || !shortcode || !passkey) {
      return NextResponse.json(
        { success: false, error: "M-Pesa is not configured. Contact the administrator." },
        { status: 503 }
      )
    }

    const body = await validateBody(req, mpesaStkSchema)

    const mfa = await requireMfaForSensitiveAction(session.user.id)
    if (!mfa.ok) {
      return NextResponse.json({ success: false, error: mfa.error }, { status: 403 })
    }

    const phone = normalizeKePhone(body.phoneNumber)
    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Invalid Kenyan phone number. Use 0712... or 254712..." },
        { status: 400 }
      )
    }

    const amount = Math.round(body.amount)
    if (amount < 1) {
      return NextResponse.json({ success: false, error: "Amount must be at least KES 1" }, { status: 400 })
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: body.invoiceId } })
    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 })
    }

    // Idempotency: reuse a recent Pending attempt for the same invoice/amount/phone
    const recentPending = await prisma.mpesaTransaction.findFirst({
      where: {
        invoiceId: body.invoiceId,
        phoneNumber: phone,
        amount,
        status: "Pending",
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    })
    if (recentPending) {
      return NextResponse.json({
        success: true,
        data: {
          checkoutRequestId: recentPending.checkoutRequestId,
          deduped: true,
          message: "A payment request was already sent. Ask the patient to check their phone.",
        },
      })
    }

    const token = await getMpesaToken()
    const now = new Date()
    const timestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0") +
      now.getHours().toString().padStart(2, "0") +
      now.getMinutes().toString().padStart(2, "0") +
      now.getSeconds().toString().padStart(2, "0")

    const baseUrl = process.env.MPESA_ENV === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke"
    const callbackUrl = process.env.MPESA_CALLBACK_URL
      || `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/callback`

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
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: body.invoiceId || "SETMCLINIC",
        TransactionDesc: "Payment for medical services",
      }),
    })

    const mpesaData = await mpesaRes.json()

    if (mpesaData.ResponseCode === "0" && body.invoiceId) {
      await prisma.mpesaTransaction.create({
        data: {
          invoiceId: body.invoiceId,
          merchantRequestId: mpesaData.MerchantRequestID || "",
          checkoutRequestId: mpesaData.CheckoutRequestID,
          phoneNumber: phone,
          amount,
          accountReference: body.invoiceId,
          transactionDesc: "Payment for medical services",
          status: "Pending",
        },
      })

      return NextResponse.json({
        success: true,
        data: {
          checkoutRequestId: mpesaData.CheckoutRequestID,
          message: "Payment request sent to the patient's phone",
        },
      })
    }

    return NextResponse.json(
      { success: false, error: "Payment initiation failed", details: mpesaData },
      { status: 502 }
    )
  } catch (error) {
    console.error("[M-Pesa STK Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
