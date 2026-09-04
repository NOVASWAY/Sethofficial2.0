import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get("unreadOnly") === "true"
  const limit = parseInt(searchParams.get("limit") || "20")

  const where: Record<string, unknown> = {
    recipientId: session.user.id,
  }
  if (unreadOnly) where.isRead = false

  const notifications = await prisma.notification.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
  })

  const unreadCount = await prisma.notification.count({
    where: { recipientId: session.user.id, isRead: false },
  })

  return NextResponse.json({ notifications, unreadCount })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const notification = await prisma.notification.create({
    data: {
      recipientId: body.recipientId,
      notificationType: body.notificationType || "in_app",
      template: body.template || "custom",
      subject: body.subject,
      content: body.content,
      priority: body.priority || "normal",
      actionUrl: body.actionUrl,
      actionLabel: body.actionLabel,
      createdById: session.user.id,
    },
  })

  return NextResponse.json(notification, { status: 201 })
}
