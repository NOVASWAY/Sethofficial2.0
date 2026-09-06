import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const notification = await prisma.notification.update({
    where: { id: params.id, recipientId: session.user.id },
    data: { isRead: true, readAt: new Date() },
  })

  return NextResponse.json({ success: true, data: notification })
}
