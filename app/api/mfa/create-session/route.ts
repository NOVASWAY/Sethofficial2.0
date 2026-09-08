import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, mfaEnabled: true, mfaSecret: true },
    })

    if (!user?.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json({ success: false, error: "MFA is not enabled" }, { status: 400 })
    }

    const sessionToken = crypto.randomBytes(32).toString("hex")

    await prisma.mfaSession.create({
      data: {
        userId: session.user.id,
        sessionToken,
        mfaVerified: false,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    return NextResponse.json({
      success: true,
      data: { sessionToken, expiresIn: 600 },
    })
  } catch (error) {
    console.error("[MFA Create Session Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
