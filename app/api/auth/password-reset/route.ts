import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { generateVerificationToken, hashToken, sendEmail, EMAIL_TEMPLATES } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ success: true, data: { message: "If an account exists, a password reset email has been sent." } })
    }

    const token = generateVerificationToken()
    const hashedToken = hashToken(token)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await prisma.verificationToken.deleteMany({ where: { identifier: `reset:${user.id}` } })

    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${user.id}`,
        token: hashedToken,
        expires: expiresAt,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || "https://sethofficial2-0.vercel.app"
    const template = EMAIL_TEMPLATES.passwordReset(token, baseUrl)

    await sendEmail({
      to: user.email!,
      subject: template.subject,
      html: template.html,
    })

    return NextResponse.json({ success: true, data: { message: "Password reset email sent." } })
  } catch (error) {
    console.error("[Password Reset Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, newPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json({ success: false, error: "Token and new password are required" }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const hashedToken = hashToken(token)

    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: hashedToken,
        expires: { gt: new Date() },
        identifier: { startsWith: "reset:" },
      },
    })

    if (!verificationToken) {
      return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 400 })
    }

    const userId = verificationToken.identifier.replace("reset:", "")
    const passwordHash = await hash(newPassword, 12)

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: verificationToken.identifier, token: hashedToken } },
    })

    return NextResponse.json({ success: true, data: { message: "Password reset successfully." } })
  } catch (error) {
    console.error("[Password Reset PUT Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
