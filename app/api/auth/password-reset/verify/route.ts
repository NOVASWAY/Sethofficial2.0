import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hashToken } from "@/lib/email"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ success: false, error: "Token is required" }, { status: 400 })
    }

    const hashedToken = hashToken(token)

    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: hashedToken,
        identifier: { startsWith: "reset:" },
      },
    })

    if (!verificationToken) {
      return NextResponse.json({ success: true, data: { valid: false, reason: "not_found" } })
    }

    if (new Date() > verificationToken.expires) {
      return NextResponse.json({ success: true, data: { valid: false, reason: "expired" } })
    }

    return NextResponse.json({ success: true, data: { valid: true } })
  } catch (error) {
    console.error("[Password Reset Verify Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
