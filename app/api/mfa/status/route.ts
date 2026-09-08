import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mfaEnabled: true, mfaMethod: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        mfaEnabled: user?.mfaEnabled || false,
        mfaMethod: user?.mfaMethod || null,
      },
    })
  } catch (error) {
    console.error("[MFA Status Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
