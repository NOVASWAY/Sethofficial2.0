import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mfaEnabled: true },
    })

    if (!user?.mfaEnabled) {
      return NextResponse.json({ success: false, error: "MFA is not enabled" }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        mfaEnabled: false,
        mfaMethod: null,
        mfaSecret: null,
      },
    })

    await prisma.mfaRecoveryCode.deleteMany({ where: { userId: session.user.id } })
    await prisma.mfaSession.deleteMany({ where: { userId: session.user.id } })

    return NextResponse.json({
      success: true,
      data: { message: "MFA disabled successfully" },
    })
  } catch (error) {
    console.error("[MFA Disable Error]", error)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
