import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { generateVerificationToken, hashToken, sendEmail, EMAIL_TEMPLATES } from "@/lib/email"
import { authLimiter, throttle } from "@/lib/rate-limit"

function throttled(req: NextRequest) {
  const t = throttle(req.headers, authLimiter, "verify-email")
  if (!t.allowed) {
    return NextResponse.json(
      { success: false, error: `Too many attempts. Try again in ${t.retryAfterSec}s.` },
      { status: 429, headers: { "Retry-After": String(t.retryAfterSec) } }
    )
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const limited = throttled(req)
    if (limited) return limited
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, emailVerified: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ success: true, data: { message: "If an account exists, a verification email has been sent." } })
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: true, data: { message: "Email is already verified." } })
    }

    const token = generateVerificationToken()
    const hashedToken = hashToken(token)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.verificationToken.deleteMany({ where: { identifier: user.id } })

    await prisma.verificationToken.create({
      data: {
        identifier: user.id,
        token: hashedToken,
        expires: expiresAt,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || "https://sethofficial2-0.vercel.app"
    const template = EMAIL_TEMPLATES.verification(token, baseUrl)

    await sendEmail({
      to: user.email!,
      subject: template.subject,
      html: template.html,
    })

    return NextResponse.json({ success: true, data: { message: "Verification email sent." } })
  } catch (error) {
    console.error("[Verify Email Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const limited = throttled(req)
    if (limited) return limited
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ success: false, error: "Token is required" }, { status: 400 })
    }

    const hashedToken = hashToken(token)

    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: hashedToken,
        expires: { gt: new Date() },
      },
    })

    if (!verificationToken) {
      return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: verificationToken.identifier },
      data: { emailVerified: true },
    })

    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: verificationToken.identifier, token: hashedToken } },
    })

    return NextResponse.json({ success: true, data: { message: "Email verified successfully." } })
  } catch (error) {
    console.error("[Verify Email GET Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
