import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    const mfaSession = await prisma.mfaSession.findUnique({
      where: { sessionToken: token },
      select: {
        mfaVerified: true,
        expiresAt: true,
        verifiedAt: true,
        createdAt: true,
      },
    })

    if (!mfaSession) {
      return NextResponse.json({ success: false, error: "Session not found" }, { status: 404 })
    }

    const expired = new Date(mfaSession.expiresAt) < new Date()

    return NextResponse.json({
      success: true,
      data: {
        verified: mfaSession.mfaVerified,
        expired,
        expiresAt: mfaSession.expiresAt,
        verifiedAt: mfaSession.verifiedAt,
      },
    })
  } catch (error) {
    console.error("[MFA Session Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
