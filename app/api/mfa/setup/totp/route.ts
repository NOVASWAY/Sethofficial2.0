import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as OTPAuth from "otpauth"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, username: true, mfaEnabled: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    if (user.mfaEnabled) {
      return NextResponse.json({ success: false, error: "MFA is already enabled. Disable it first." }, { status: 400 })
    }

    const totp = new OTPAuth.TOTP({
      issuer: "Seth Medical Clinic",
      label: user.username,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: new OTPAuth.Secret({ size: 20 }),
    })

    const secret = totp.secret.base32
    const otpauthUrl = totp.toString()

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`

    await prisma.user.update({
      where: { id: session.user.id },
      data: { mfaSecret: secret },
    })

    return NextResponse.json({
      success: true,
      data: {
        secret,
        otpauthUrl,
        qrCodeUrl,
        method: "totp",
      },
    })
  } catch (error) {
    console.error("[MFA Setup Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
